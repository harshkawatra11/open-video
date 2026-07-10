/**
 * OpenVideo daemon — the single privileged process (PRD §8.3, ADR-0008).
 *
 * A zero-dependency node:http + SSE server hosting the thin-agent-wrapper workflow (ADR-0014):
 * scaffold a per-project workspace, spawn a headless Claude Code session in it with full Bash/Write
 * tool freedom, stream its activity to the Studio UI. This is the only component that touches the
 * filesystem, spawns tools, or reaches the network — the Studio talks ONLY to this process.
 *
 * The legacy EDD/IR/DAG/MCP-Director agent path (ADR-0005) that this superseded — and the packages
 * that only existed to back it (edd, compiler, mcp-server, agents, plugin-sdk, library,
 * integrations, project, prompt, apps/cockpit, apps/electron) — has been removed from this file and
 * from pnpm-workspace.yaml (Phase 6). They are parked in git history, not deleted from it; see
 * ADR-0014 "Consequences" for why they might be worth reviving for a future collaborative/diffable
 * editing mode.
 */

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { isAvailable, resolveBin } from "@openvideo/render";
import { planInstall, baseProfile } from "@openvideo/installer";
import type { HardwareProfile } from "@openvideo/installer";
import { spawnClaude } from "@openvideo/cli-adapter";
import { friendlyTerminalLine } from "@openvideo/shared";
import type { ModelId } from "@openvideo/shared";
import { scaffoldWorkspace, installRemotionDeps } from "@openvideo/workspace-template";
import type { BrandKit } from "@openvideo/workspace-template";
import { resolvePythonBin } from "@openvideo/transcribe";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Deliberately not a dotted directory name (was `.openvideo`) — confirmed via a real end-to-end
// edit that Remotion's renderer (`get-extension-of-filename.js`) splits the *entire* render path
// on `.` and misreads any dotted ancestor directory as a file extension, throwing "The output
// directory cannot have an extension" and blocking every workspace's render step. The agent found
// and worked around it by patching node_modules directly, but that patch doesn't survive the next
// `pnpm install`, so every future workspace would hit this again. Removing the dot from the
// directory name itself avoids the whole bug class permanently instead of relying on a workaround
// getting rediscovered (or hoping memory/craft-learnings.txt is read carefully enough) each time.
const WORKDIR = process.env.OPENVIDEO_WORKDIR ?? path.join(os.homedir(), "openvideo-work");
const PORT = Number(process.env.OPENVIDEO_PORT ?? 7777);
const VERSION = "0.0.0";

fs.mkdirSync(WORKDIR, { recursive: true });

// A long-running local daemon must survive stray async errors (e.g. a client disconnecting mid-
// stream). Log and keep serving rather than exiting.
process.on("uncaughtException", (e) => console.error("[daemon] uncaughtException:", e));
process.on("unhandledRejection", (e) => console.error("[daemon] unhandledRejection:", e));

// ---- session usage (in-memory; resets on daemon restart — the token counter in TopBar reads this
// via GET /api/usage, polled independently of any one session's SSE stream). ----
const usageTotals = { sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

// ---- ADR-0014 thin-agent-wrapper workspaces (in-memory registry; the workspace directory on disk
// is the durable state — this just indexes it and buffers events for reconnect). ----
const WORKSPACES_DIR = path.join(WORKDIR, "workspaces");
fs.mkdirSync(WORKSPACES_DIR, { recursive: true });

interface WorkspaceEntry {
  id: string;
  name: string;
  dir: string;
  prd: string;
  brand: BrandKit;
  status: "pending_source" | "scaffolding" | "ready" | "editing" | "edited" | "incomplete" | "error";
  sessionId?: string;
  createdAt: string;
  errorMessage?: string;
}
const workspaces = new Map<string, WorkspaceEntry>();

// Bounded per-workspace event log so a browser refresh / reconnect mid-edit (a real edit can run
// 10-15+ min) can replay what it missed via GET .../events?since=N instead of losing the session.
const MAX_BUFFERED_EVENTS = 2000;
const workspaceEvents = new Map<string, Array<{ seq: number; event: unknown }>>();
function pushWorkspaceEvent(workspaceId: string, event: unknown): void {
  const log = workspaceEvents.get(workspaceId) ?? [];
  const seq = log.length > 0 ? log[log.length - 1]!.seq + 1 : 0;
  log.push({ seq, event });
  if (log.length > MAX_BUFFERED_EVENTS) log.splice(0, log.length - MAX_BUFFERED_EVENTS);
  workspaceEvents.set(workspaceId, log);
}

const GLOBAL_LEARNINGS_PATH = path.join(WORKDIR, "memory", "craft-learnings.txt");

/** A CLI session ending (loop exhausted or client disconnect via sse.closed) does NOT mean the
 *  edit actually produced anything — confirmed by a real run where the browser navigated away
 *  mid-edit and the workspace was left showing status "edited" with no out/final-edit.mp4 on
 *  disk, so the UI rendered a broken video player. Only ever report "edited" once the file the
 *  CLAUDE.md template's completion contract (`DONE: out/final-edit.mp4`) promises actually exists. */
function hasFinalEdit(entry: WorkspaceEntry): boolean {
  return fs.existsSync(path.join(entry.dir, "out", "final-edit.mp4"));
}

function streamToFile(req: http.IncomingMessage, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(dest);
    req.pipe(ws);
    ws.on("finish", () => resolve());
    ws.on("error", reject);
    req.on("error", reject);
  });
}

// ---------- helpers ----------
function json(res: http.ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(s) });
  res.end(s);
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 5_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch (e) {
        reject(e as Error);
      }
    });
    req.on("error", reject);
  });
}

function openSse(res: http.ServerResponse) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  let clientGone = false;
  res.on("close", () => {
    clientGone = true;
  });
  return {
    send(o: unknown) {
      if (clientGone || res.writableEnded) return;
      try {
        res.write(`data: ${JSON.stringify(o)}\n\n`);
      } catch {
        clientGone = true; // client vanished mid-write — stop, never crash the daemon
      }
    },
    close() {
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {
          /* ignore */
        }
      }
    },
    get closed(): boolean {
      return clientGone || res.writableEnded;
    },
  };
}

// ---- honest tool detection (Phase 4, ADR-0014): the old profile just recorded "present"/null —
// on a machine where everything is actually installed that told the user nothing they could act
// on, and on a machine missing something it gave no install command. Every check below reports a
// real version string and path when found, or the reason it's missing, matching what the setup
// screen actually needs to say ("ready (vX at <path>)" / "missing (+ install command)" /
// "degraded (found but...)"). ----
interface ToolCheck {
  status: "ready" | "missing" | "degraded";
  version?: string;
  path?: string;
  detail: string;
}

function probeVersion(bin: string, args: string[], versionRegex: RegExp): ToolCheck {
  const resolved = resolveBin(bin);
  if (!path.isAbsolute(resolved)) {
    return { status: "missing", detail: `${bin} not found on PATH` };
  }
  try {
    // Same class of bug as installer.ts's pnpm spawn and cli-adapter's Claude CLI resolution: on
    // Windows, npm-installed CLIs (claude, pnpm) resolve to a `.cmd` shim, and Node's
    // execFileSync/spawn cannot exec a `.cmd` directly without shell:true (throws EINVAL) —
    // confirmed live, this doctor check itself reported Claude CLI and pnpm as "failed to run"
    // on a machine where both work fine from a real shell. Safe here: args are always fixed
    // version flags, never user-controlled text.
    const out = execFileSync(resolved, args, {
      windowsHide: true,
      timeout: 8000,
      encoding: "utf8",
      shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(resolved),
    });
    const m = out.match(versionRegex);
    const version = m?.[1] ?? "unknown version";
    return { status: "ready", version, path: resolved, detail: `v${version} at ${resolved}` };
  } catch (e) {
    return { status: "degraded", path: resolved, detail: `found at ${resolved} but failed to run: ${(e as Error).message.slice(0, 200)}` };
  }
}

/** ffmpeg's HDR tonemap recipe (CLAUDE.md template) needs zscale — a real ffmpeg install can still
 *  be built without it, so this is a genuinely separate check from "ffmpeg exists". */
function ffmpegHasZscale(ffmpegPath: string): boolean {
  try {
    const out = execFileSync(ffmpegPath, ["-hide_banner", "-filters"], { windowsHide: true, timeout: 8000, encoding: "utf8" });
    return /\bzscale\b/.test(out);
  } catch {
    return false;
  }
}

function getProfile(): HardwareProfile {
  const base = baseProfile();
  const ffmpeg = probeVersion("ffmpeg", ["-version"], /ffmpeg version (\S+)/);
  return {
    ...base,
    gpu: { nvidia: isAvailable("nvidia-smi") },
    freeDiskGB: 0,
    tools: {
      ffmpeg: ffmpeg.status === "ready" ? ffmpeg.version! : null,
      ffprobe: isAvailable("ffprobe") ? "present" : null,
      claude: isAvailable("claude") ? "present" : null,
      pnpm: isAvailable("pnpm") ? "present" : null,
      "yt-dlp": isAvailable("yt-dlp") ? "present" : null,
      node: process.version,
    },
  };
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp4": "video/mp4",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

// ---------- request router ----------
const server = http.createServer(async (req, res) => {
  // CORS: the studio dev server (next dev, its own port) talks to this daemon directly rather
  // than through Next's rewrites() proxy — that proxy was confirmed to not stream a long-lived SSE
  // response incrementally to the browser, which silently broke the live "alive terminal" feed
  // (see next.config.mjs / lib/daemon.ts). Local-first (ADR-0008): this daemon only ever listens
  // on localhost and has no auth/session cookies to leak, so reflecting any Origin is fine here —
  // it is not exposed to the network the way a multi-tenant server's CORS policy would be.
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const route = `${req.method} ${url.pathname}`;
  try {
    switch (route) {
      case "GET /health":
        return json(res, 200, { ok: true, name: "openvideo-daemon", version: VERSION, workdir: WORKDIR });

      case "GET /api/profile":
        return json(res, 200, getProfile());

      case "POST /api/install/plan": {
        const body = await readJson(req);
        const capability = String(body.capability ?? "");
        return json(res, 200, planInstall(capability, getProfile()));
      }
    }

    // ---- ADR-0014 thin-agent-wrapper workspaces ----
    // Create a workspace record (metadata only — scaffolding happens once the source video lands
    // in POST .../source, since scaffoldWorkspace() needs the video path up front).
    if (req.method === "POST" && url.pathname === "/api/workspaces") {
      const body = await readJson(req);
      const id = randomUUID();
      const name = String(body.name ?? "untitled-edit").replace(/[^\w.\- ]/g, "_");
      const entry: WorkspaceEntry = {
        id,
        name,
        dir: path.join(WORKSPACES_DIR, id),
        prd: String(body.prd ?? ""),
        brand: {
          brandContext: String(body.brandContext ?? "No brand context supplied — ask the user before designing on-screen identity."),
          ...(body.emphasisTerms ? { emphasisTerms: body.emphasisTerms as string[] } : {}),
        },
        status: "pending_source",
        createdAt: new Date().toISOString(),
      };
      workspaces.set(id, entry);
      return json(res, 200, { id, status: entry.status });
    }

    if (req.method === "GET" && url.pathname === "/api/workspaces") {
      return json(res, 200, { workspaces: [...workspaces.values()] });
    }

    const mWkGet = url.pathname.match(/^\/api\/workspaces\/([^/]+)$/);
    if (mWkGet && req.method === "GET") {
      const entry = workspaces.get(decodeURIComponent(mWkGet[1]!));
      if (!entry) return json(res, 404, { error: "unknown workspace" });
      return json(res, 200, entry);
    }

    // Upload the source video; on completion, scaffold the workspace (CLAUDE.md + Remotion
    // skeleton + PRD.md) and pnpm-install the Remotion deps. SSE so the (real, non-trivial) install
    // step has visible progress instead of the request just hanging.
    const mWkSource = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/source$/);
    if (mWkSource && req.method === "POST") {
      const entry = workspaces.get(decodeURIComponent(mWkSource[1]!));
      if (!entry) return json(res, 404, { error: "unknown workspace" });
      const sse = openSse(res);
      try {
        const ext = (url.searchParams.get("ext") ?? ".mp4").replace(/[^\w.]/g, "") || ".mp4";
        const tmp = path.join(WORKSPACES_DIR, `${entry.id}-upload${ext}`);
        sse.send({ line: "Uploading source video..." });
        await streamToFile(req, tmp);

        entry.status = "scaffolding";
        sse.send({ line: "Scaffolding workspace (CLAUDE.md, Remotion skeleton)..." });
        const scaffold = await scaffoldWorkspace({
          projectDir: entry.dir,
          sourceVideoPath: tmp,
          prd: entry.prd,
          brand: entry.brand,
          globalLearningsPath: fs.existsSync(GLOBAL_LEARNINGS_PATH) ? GLOBAL_LEARNINGS_PATH : undefined,
        });
        fs.unlinkSync(tmp);

        sse.send({ line: "Installing Remotion dependencies (pnpm install)..." });
        await installRemotionDeps(scaffold.remotionDir, (p) => sse.send({ line: p.chunk.trim() }));

        entry.status = "ready";
        sse.send({ type: "workspace.ready", workspaceId: entry.id, line: "Workspace ready." });
      } catch (e) {
        entry.status = "error";
        entry.errorMessage = (e as Error).message;
        sse.send({ type: "error", line: `Scaffold failed: ${(e as Error).message}` });
      } finally {
        sse.close();
      }
      return;
    }

    // Run the edit: spawn Claude headless *in the workspace directory*, full Bash/Write tool
    // freedom, no --mcp-config (ADR-0014). Persists the CLI's own session_id so a later tweak can
    // --resume it.
    const mWkEdit = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/edit$/);
    if (mWkEdit && req.method === "POST") {
      const entry = workspaces.get(decodeURIComponent(mWkEdit[1]!));
      if (!entry) return json(res, 404, { error: "unknown workspace" });
      if (entry.status !== "ready" && entry.status !== "edited" && entry.status !== "incomplete") {
        return json(res, 400, { error: `workspace is "${entry.status}", not ready for an edit session` });
      }
      if (!isAvailable("claude")) {
        const sse = openSse(res);
        sse.send({ type: "agent.error", line: "Claude CLI not found on PATH." });
        sse.close();
        return;
      }
      const body = await readJson(req).catch(() => ({}));
      const model = (body.model as ModelId) ?? "claude-sonnet-4-6";
      const effort = body.effort ? String(body.effort) : undefined;

      entry.status = "editing";
      const sse = openSse(res);
      try {
        for await (const ev of spawnClaude({
          prompt: "Read CLAUDE.md and PRD.md in this workspace, then execute the edit.",
          model,
          cwd: entry.dir,
          permissionMode: "acceptEdits",
          ...(effort ? { effort } : {}),
        })) {
          if (ev.type === "usage.delta") {
            usageTotals.inputTokens += ev.inputTokens;
            usageTotals.outputTokens += ev.outputTokens;
            usageTotals.cacheReadTokens += ev.cacheReadTokens;
          }
          if (!entry.sessionId && (ev as { sessionId?: string }).sessionId) {
            entry.sessionId = (ev as { sessionId: string }).sessionId;
          }
          const line = { event: ev, line: friendlyTerminalLine(ev) };
          pushWorkspaceEvent(entry.id, line);
          sse.send(line);
          if (sse.closed) break;
        }
        // The loop can end for two very different reasons: the CLI session actually finished, or
        // the client disconnected mid-edit (sse.closed) and we just stopped listening while the
        // child kept running or got abandoned. Only "edited" if CLAUDE.md's completion contract
        // (DONE: out/final-edit.mp4) actually held — see hasFinalEdit().
        entry.status = hasFinalEdit(entry) ? "edited" : "incomplete";
        usageTotals.sessions++;
      } catch (e) {
        entry.status = "error";
        entry.errorMessage = (e as Error).message;
        sse.send({ type: "agent.error", line: `Edit session failed: ${(e as Error).message}` });
      } finally {
        sse.close();
      }
      return;
    }

    // Tweak: resume the prior CLI session with a follow-up instruction. Falls back to a fresh
    // session (told to read memory/ and out/ first) if resume fails — e.g. the daemon restarted
    // and the CLI's own session store no longer has that id.
    const mWkTweak = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/tweak$/);
    if (mWkTweak && req.method === "POST") {
      const entry = workspaces.get(decodeURIComponent(mWkTweak[1]!));
      if (!entry) return json(res, 404, { error: "unknown workspace" });
      const body = await readJson(req);
      const text = String(body.text ?? "");
      if (!text) return json(res, 400, { error: "text is required" });

      const sse = openSse(res);
      entry.status = "editing";
      const runOnce = async (resume: string | undefined, prompt: string) => {
        for await (const ev of spawnClaude({
          prompt,
          model: "claude-sonnet-4-6",
          cwd: entry.dir,
          permissionMode: "acceptEdits",
          ...(resume ? { resume } : {}),
        })) {
          if (!entry.sessionId && (ev as { sessionId?: string }).sessionId) {
            entry.sessionId = (ev as { sessionId: string }).sessionId;
          }
          const line = { event: ev, line: friendlyTerminalLine(ev) };
          pushWorkspaceEvent(entry.id, line);
          sse.send(line);
          if (sse.closed) break;
        }
      };
      try {
        try {
          await runOnce(entry.sessionId, text);
        } catch (e) {
          if (!entry.sessionId) throw e;
          sse.send({ line: `Resume failed (${(e as Error).message}), starting a fresh session with context...` });
          await runOnce(undefined, `Read memory/ and out/ in this workspace first — this is a tweak on a prior edit. Then: ${text}`);
        }
        entry.status = hasFinalEdit(entry) ? "edited" : "incomplete";
      } catch (e) {
        entry.status = "error";
        entry.errorMessage = (e as Error).message;
        sse.send({ type: "agent.error", line: `Tweak failed: ${(e as Error).message}` });
      } finally {
        sse.close();
      }
      return;
    }

    // Replay buffered events for reconnect after a browser refresh mid-edit.
    const mWkEvents = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/events$/);
    if (mWkEvents && req.method === "GET") {
      const entry = workspaces.get(decodeURIComponent(mWkEvents[1]!));
      if (!entry) return json(res, 404, { error: "unknown workspace" });
      const since = Number(url.searchParams.get("since") ?? "-1");
      const log = workspaceEvents.get(entry.id) ?? [];
      return json(res, 200, { events: log.filter((e) => e.seq > since), status: entry.status });
    }

    // Serve the finished edit.
    const mWkOutput = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/output$/);
    if (mWkOutput && req.method === "GET") {
      const entry = workspaces.get(decodeURIComponent(mWkOutput[1]!));
      if (!entry) return json(res, 404, { error: "unknown workspace" });
      const outPath = path.join(entry.dir, "out", "final-edit.mp4");
      if (!fs.existsSync(outPath)) return json(res, 404, { error: "not rendered yet" });
      res.writeHead(200, { "content-type": "video/mp4" });
      fs.createReadStream(outPath).pipe(res);
      return;
    }

    // ---- usage (in-memory; the token meter in TopBar polls this) ----
    if (req.method === "GET" && url.pathname === "/api/usage") {
      return json(res, 200, usageTotals);
    }

    // ---- doctor: a synthesized diagnostic report (real version+path probes, Phase 4) ----
    if (req.method === "GET" && url.pathname === "/api/doctor") {
      const profile = getProfile();
      const pythonBin = resolvePythonBin();

      type CheckStatus = "pass" | "warn" | "fail";
      interface Check {
        id: string;
        label: string;
        status: CheckStatus;
        detail: string;
        suggestion?: string;
      }

      // Real version+path probes, not boolean presence — Phase 4 (ADR-0014). The old checks said
      // "present"/null, which tells a user with everything installed nothing useful and a user
      // missing something no install command to run. Every tool the thin-agent-wrapper workflow
      // actually needs (see packages/workspace-template's template CLAUDE.md) gets checked here;
      // VOID/CUDA-tier checks are cut since packages/integrations' VOID path is parked.
      const ffmpeg = probeVersion("ffmpeg", ["-version"], /ffmpeg version (\S+)/);
      const ffprobe = probeVersion("ffprobe", ["-version"], /ffprobe version (\S+)/);
      const claude = probeVersion("claude", ["--version"], /([\d.]+)/);
      const pnpmCheck = probeVersion("pnpm", ["--version"], /([\d.]+)/);
      const zscaleOk = ffmpeg.status === "ready" && ffmpeg.path ? ffmpegHasZscale(ffmpeg.path) : false;
      const pythonVersion = pythonBin
        ? (() => {
            try {
              return execFileSync(pythonBin, ["--version"], { windowsHide: true, timeout: 5000, encoding: "utf8" }).trim();
            } catch {
              return pythonBin;
            }
          })()
        : null;

      const checks: Check[] = [
        {
          id: "ffmpeg",
          label: "FFmpeg",
          status: ffmpeg.status === "ready" ? "pass" : ffmpeg.status === "degraded" ? "warn" : "fail",
          detail: ffmpeg.detail,
          ...(ffmpeg.status !== "ready" ? { suggestion: "Install ffmpeg (winget install ffmpeg, or add an existing install to PATH)." } : {}),
        },
        {
          id: "ffmpeg-zscale",
          label: "FFmpeg zscale filter (HDR tonemap)",
          status: ffmpeg.status !== "ready" ? "warn" : zscaleOk ? "pass" : "warn",
          detail: ffmpeg.status !== "ready" ? "ffmpeg missing — see above" : zscaleOk ? "zscale filter available" : "ffmpeg build lacks zscale/zimg",
          ...(ffmpeg.status === "ready" && !zscaleOk
            ? { suggestion: "The HDR tonemap recipe (CLAUDE.md) needs a zimg-enabled ffmpeg build (e.g. the Gyan Windows build)." }
            : {}),
        },
        {
          id: "ffprobe",
          label: "FFprobe",
          status: ffprobe.status === "ready" ? "pass" : "fail",
          detail: ffprobe.detail,
          ...(ffprobe.status !== "ready" ? { suggestion: "Usually ships alongside ffmpeg — reinstall ffmpeg if only ffprobe is missing." } : {}),
        },
        {
          id: "claude",
          label: "Claude CLI",
          status: claude.status === "ready" ? "pass" : "fail",
          detail: claude.detail,
          ...(claude.status !== "ready" ? { suggestion: "Install the Claude CLI (npm i -g @anthropic-ai/claude-code) and sign in." } : {}),
        },
        {
          id: "pnpm",
          label: "pnpm",
          status: pnpmCheck.status === "ready" ? "pass" : "fail",
          detail: pnpmCheck.detail,
          ...(pnpmCheck.status !== "ready" ? { suggestion: "Needed to install each workspace's per-project Remotion deps (npm i -g pnpm)." } : {}),
        },
        {
          id: "gpu",
          label: "NVIDIA GPU",
          status: profile.gpu.nvidia ? "pass" : "warn",
          detail: profile.gpu.nvidia ? "detected (NVENC available for encoding)" : "not detected — CPU (libx264) fallback in effect",
        },
        {
          id: "python",
          label: "Python (transcription heavy tier)",
          status: pythonVersion ? "pass" : "warn",
          detail: pythonVersion ? `${pythonVersion} at ${pythonBin}` : "no interpreter found on PATH",
          ...(!pythonVersion ? { suggestion: "Needed for faster-whisper transcription when no transcript is supplied. Install Python 3.9+." } : {}),
        },
      ];

      return json(res, 200, { checks, profile });
    }

    // GET /api/file?path=<abs within WORKDIR>
    if (req.method === "GET" && url.pathname === "/api/file") {
      const p = path.resolve(url.searchParams.get("path") ?? "");
      const root = path.resolve(WORKDIR);
      const within =
        process.platform === "win32"
          ? p.toLowerCase().startsWith(root.toLowerCase())
          : p.startsWith(root);
      if (!within || !fs.existsSync(p)) return json(res, 403, { error: "forbidden" });
      res.writeHead(200, { "content-type": MIME[path.extname(p)] ?? "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
      return;
    }

    return json(res, 404, { error: "not found", route });
  } catch (e) {
    return json(res, 500, { error: (e as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`OpenVideo daemon listening on http://localhost:${PORT}`);
  console.log(`  workdir:  ${WORKDIR}`);
  const p = getProfile();
  console.log(`  tools:    ffmpeg=${p.tools.ffmpeg ?? "-"} claude=${p.tools.claude ?? "-"} gpu.nvidia=${p.gpu.nvidia}`);
});
