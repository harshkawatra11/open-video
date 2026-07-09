/**
 * OpenVideo daemon — the single privileged process (PRD §8.3, ADR-0008).
 *
 * A zero-dependency node:http + SSE server that hosts the Edit/Session protocol, runs real renders
 * (compiler -> render executor), can spawn the Claude CLI for agentic sessions, and serves the web
 * cockpit. The renderer/cockpit talk ONLY to this process; this is the only component that touches
 * the filesystem, spawns tools, or reaches the network.
 */

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { compile } from "@openvideo/compiler";
import { runDAG, runFfmpeg, isAvailable } from "@openvideo/render";
import type { RunEvent } from "@openvideo/render";
import { planInstall, baseProfile } from "@openvideo/installer";
import type { HardwareProfile } from "@openvideo/installer";
import { spawnClaude } from "@openvideo/cli-adapter";
import { friendlyTerminalLine } from "@openvideo/shared";
import { scaffoldWorkspace, installRemotionDeps } from "@openvideo/workspace-template";
import type { BrandKit } from "@openvideo/workspace-template";
import { createProject, openProject, ingestAsset, scaffoldEdd, saveEdd, loadEdd, sourcesMap, readManifest, addLibraryAsset } from "@openvideo/project";
import { loadRefineTemplate, buildRefineInput } from "@openvideo/prompt";
import type { ModelId } from "@openvideo/shared";
import type { EDD } from "@openvideo/edd";
import { createDefaultRegistry, openKeystore } from "@openvideo/library";
import type { ProviderKind } from "@openvideo/library";
import { analyzeFootage, removeObject, isVoidAvailable } from "@openvideo/integrations";
import { transcribe, resolvePythonBin } from "@openvideo/transcribe";
import type { VfxPlan } from "@openvideo/render";
import { discoverPlugins } from "@openvideo/plugin-sdk";
import { buildDirectorSystemPrompt } from "@openvideo/agents";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COCKPIT_DIR = path.resolve(HERE, "../../cockpit/public");
const MCP_SERVER_BIN = path.resolve(HERE, "../../../packages/mcp-server/bin/mcp-stdio.ts");
const PLUGINS_DIR = path.resolve(HERE, "../../../plugins");
const WORKDIR = process.env.OPENVIDEO_WORKDIR ?? path.join(os.homedir(), ".openvideo", "work");
const PORT = Number(process.env.OPENVIDEO_PORT ?? 7777);
const PROJECTS_DIR = path.join(WORKDIR, "projects");
const KEYSTORE_DIR = path.join(WORKDIR, "keystore");
const MCP_CONFIG_PATH = path.join(WORKDIR, "mcp", "openvideo-mcp.config.json");
const VERSION = "0.0.0";

fs.mkdirSync(WORKDIR, { recursive: true });
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

// The MCP server (packages/mcp-server) is what closes the agentic loop (CLAUDE.md invariant 5): it
// exposes edd_get/edd_apply_patch/edd_render/analyze_footage/library_search/library_insert/
// project_get as typed tools the Claude CLI can actually call. We write its --mcp-config once at
// startup; the child process re-derives WORKDIR from its own env (see mcp-server/src/context.ts).
function writeMcpConfig(): void {
  fs.mkdirSync(path.dirname(MCP_CONFIG_PATH), { recursive: true });
  const config = {
    mcpServers: {
      openvideo: {
        command: process.execPath,
        args: [MCP_SERVER_BIN],
        env: { OPENVIDEO_WORKDIR: WORKDIR },
      },
    },
  };
  fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
}
writeMcpConfig();

// The asset library provider registry (doc 24, ADR-0010): keyless providers active now, key-gated
// providers registered but disabled until their key lands in the encrypted keystore.
const keystore = openKeystore(KEYSTORE_DIR);
const library = createDefaultRegistry({ resolveKey: (id) => keystore.get(id) });

// A long-running local daemon must survive stray async errors (e.g. a client disconnecting mid-
// stream). Log and keep serving rather than exiting.
process.on("uncaughtException", (e) => console.error("[daemon] uncaughtException:", e));
process.on("unhandledRejection", (e) => console.error("[daemon] unhandledRejection:", e));

// ---- session usage + render history (in-memory; resets on daemon restart — the Usage meter and
// Render Queue screens read this via GET /api/usage and GET /api/renders). ----
const usageTotals = { sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
interface RenderLogEntry {
  id: string;
  projectId?: string;
  status: "running" | "done" | "error";
  output?: string;
  message?: string;
  startedAt: string;
  finishedAt?: string;
}
const renderLog: RenderLogEntry[] = [];
function pushRenderLog(entry: RenderLogEntry): void {
  renderLog.unshift(entry);
  if (renderLog.length > 50) renderLog.length = 50;
}

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
  status: "pending_source" | "scaffolding" | "ready" | "editing" | "edited" | "error";
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

/** Bridges a render-package VfxPlan (data-only, no integrations dependency — see
 *  packages/render/src/context.ts) to the real VOID adapter. Honest failures (no GPU / weights not
 *  installed) propagate as-is; never silently skips the effect the EDD asked for. */
async function voidExecutor(plan: VfxPlan): Promise<void> {
  await removeObject(
    { clipPath: plan.inputPath, atS: plan.atS, region: plan.region, maskPath: plan.maskRef, prompt: plan.prompt },
    plan.outPath,
  );
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

function getProfile(): HardwareProfile {
  const base = baseProfile();
  return {
    ...base,
    gpu: { nvidia: isAvailable("nvidia-smi") },
    freeDiskGB: 0,
    tools: {
      ffmpeg: isAvailable("ffmpeg") ? "present" : null,
      ffprobe: isAvailable("ffprobe") ? "present" : null,
      claude: isAvailable("claude") ? "present" : null,
      remotion: isAvailable("remotion") ? "present" : null,
      "yt-dlp": isAvailable("yt-dlp") ? "present" : null,
      node: process.version,
    },
  };
}

const OP_PHRASE: Record<string, string> = {
  cut: "Cutting clips",
  tonemap_grade: "Grading color",
  level_audio: "Optimizing audio",
  remotion_render: "Rendering graphics",
  ffmpeg_compose: "Compositing",
  encode: "Exporting",
};

function renderLine(e: RunEvent): string {
  switch (e.type) {
    case "node-start":
      return `${OP_PHRASE[e.op] ?? e.op}...`;
    case "node-cached":
      return `${e.id}: cached`;
    case "node-done":
      return `${e.id}: done`;
    case "node-error":
      return `error in ${e.id}: ${e.message}`;
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp4": "video/mp4",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

function serveStatic(res: http.ServerResponse, urlPath: string): void {
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const abs = path.resolve(COCKPIT_DIR, rel);
  if (!abs.startsWith(COCKPIT_DIR) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    json(res, 404, { error: "not found" });
    return;
  }
  const data = fs.readFileSync(abs);
  res.writeHead(200, { "content-type": MIME[path.extname(abs)] ?? "application/octet-stream" });
  res.end(data);
}

// ---------- a minimal demo EDD (no external media; source is generated) ----------
function demoEdd(source: string): EDD {
  return {
    schemaVersion: "1.0",
    id: "edd_demo",
    project: { id: "prj_demo", width: 720, height: 1280, fps: 30, colorSpace: "bt709", platform: "instagram_reel" },
    sources: [{ id: "src_1", path: source }],
    timeline: {
      durationS: 3,
      tracks: [
        {
          id: "aroll",
          kind: "video",
          clips: [
            { id: "c1", src: "src_1", inS: 0, outS: 1.5, transform: { punchIn: { from: 1.0, to: 1.04, ease: "io" } } },
            { id: "c2", src: "src_1", inS: 1.5, outS: 3.0, transform: { punchIn: { from: 1.04, to: 1.0, ease: "io" } } },
          ],
          transitions: [{ between: ["c1", "c2"], type: "cut" }],
          effects: [{ type: "color", spec: { contrast: "s_curve_light", vibrance: 0.1, sharpen: 0.4 } }],
        },
        { id: "audio", kind: "audio", voice: { chain: [], loudness: { targetLUFS: -14, tpDb: -1.5 } } },
      ],
    },
    export: { container: "mp4", vcodec: "h264_high", acodec: "aac", w: 720, h: 1280, fps: 30, crf: 20, faststart: true },
  };
}

// ---------- prompt -> PRD refinement (PRD §16; two-stage prompting) ----------
const REPO_ROOT = path.resolve(HERE, "../../..");
const PROMPT_TEMPLATE_PATH = process.env.OPENVIDEO_PROMPT_TEMPLATE;
const REFINE_EFFORT = process.env.OPENVIDEO_REFINE_EFFORT ?? "low";
type Sse = ReturnType<typeof openSse>;

async function refineToPrd(userPrompt: string, sse?: Sse): Promise<{ prdPrompt: string; file: string; source: string; isPlaceholder: boolean }> {
  const t = loadRefineTemplate({ ...(PROMPT_TEMPLATE_PATH ? { path: PROMPT_TEMPLATE_PATH } : {}), repoRoot: REPO_ROOT });
  if (t.isPlaceholder) sse?.send({ line: "Note: using the PLACEHOLDER prompt→PRD template (set OPENVIDEO_PROMPT_TEMPLATE to override)." });
  sse?.send({ line: `Drafting a PRD-level prompt with Opus (effort=${REFINE_EFFORT || "default"})…` });
  const input = buildRefineInput(t.template, userPrompt);
  let text = "";
  for await (const ev of spawnClaude({ prompt: input, model: "claude-opus-4-8", cwd: WORKDIR, ...(REFINE_EFFORT ? { effort: REFINE_EFFORT } : {}) })) {
    if (ev.type === "agent.message") text += ev.text;
    sse?.send({ event: ev, line: friendlyTerminalLine(ev) });
    if (sse?.closed) break;
  }
  const dir = path.join(WORKDIR, "prds");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}.prd.txt`);
  fs.writeFileSync(file, text.trim());
  return { prdPrompt: text.trim(), file, source: t.source, isPlaceholder: t.isPlaceholder };
}

// ---------- request router ----------
const server = http.createServer(async (req, res) => {
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

      case "POST /api/demo-render": {
        const sse = openSse(res);
        const dir = fs.mkdtempSync(path.join(WORKDIR, "demo-"));
        const logEntry: RenderLogEntry = { id: randomUUID(), status: "running", startedAt: new Date().toISOString() };
        pushRenderLog(logEntry);
        try {
          const source = path.join(dir, "source.mp4");
          sse.send({ line: "Generating test footage..." });
          await runFfmpeg([
            "-y",
            "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=320:duration=3",
            "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", source,
          ]);
          const dag = compile(demoEdd(source));
          const out = await runDAG(dag, {
            projectDir: dir,
            width: 720,
            height: 1280,
            fps: 30,
            capabilities: { gpu: { nvidia: isAvailable("nvidia-smi") }, remotionCompositor: "unhealthy" },
            sources: { src_1: source },
            onEvent: (e) => sse.send({ event: e, line: renderLine(e) }),
          });
          logEntry.status = "done";
          logEntry.output = out;
          logEntry.finishedAt = new Date().toISOString();
          sse.send({ type: "render.done", output: out, line: "Render complete." });
        } catch (e) {
          logEntry.status = "error";
          logEntry.message = (e as Error).message;
          logEntry.finishedAt = new Date().toISOString();
          sse.send({ type: "error", line: `Render failed: ${(e as Error).message}` });
        } finally {
          sse.close();
        }
        return;
      }

      case "POST /api/render": {
        const sse = openSse(res);
        const logEntry: RenderLogEntry = { id: randomUUID(), status: "running", startedAt: new Date().toISOString() };
        pushRenderLog(logEntry);
        try {
          const body = await readJson(req);
          const edd = body.edd as EDD;
          const sources = (body.sources as Record<string, string>) ?? {};
          const dir = (body.projectDir as string) ?? fs.mkdtempSync(path.join(WORKDIR, "render-"));
          const dag = compile(edd);
          const out = await runDAG(dag, {
            projectDir: dir,
            width: edd.project.width,
            height: edd.project.height,
            fps: edd.project.fps,
            capabilities: { gpu: { nvidia: isAvailable("nvidia-smi") }, remotionCompositor: "unhealthy" },
            sources,
            onEvent: (e) => sse.send({ event: e, line: renderLine(e) }),
            voidExecutor,
          });
          logEntry.status = "done";
          logEntry.output = out;
          logEntry.finishedAt = new Date().toISOString();
          sse.send({ type: "render.done", output: out, line: "Render complete." });
        } catch (e) {
          logEntry.status = "error";
          logEntry.message = (e as Error).message;
          logEntry.finishedAt = new Date().toISOString();
          sse.send({ type: "error", line: `Render failed: ${(e as Error).message}` });
        } finally {
          sse.close();
        }
        return;
      }

      case "POST /api/refine-prompt": {
        const sse = openSse(res);
        try {
          const body = await readJson(req);
          if (!isAvailable("claude")) {
            sse.send({ type: "agent.error", line: "Claude CLI not found on PATH." });
            sse.close();
            return;
          }
          const r = await refineToPrd(String(body.prompt ?? ""), sse);
          sse.send({ type: "prd.ready", prdPrompt: r.prdPrompt, file: r.file, source: r.source, line: `PRD prompt drafted → ${path.basename(r.file)}` });
        } catch (e) {
          sse.send({ type: "agent.error", line: `Refine failed: ${(e as Error).message}` });
        } finally {
          sse.close();
        }
        return;
      }

      case "POST /api/session": {
        const sse = openSse(res);
        try {
          const body = await readJson(req);
          const rawPrompt = String(body.prompt ?? "");
          const model = (body.model as ModelId) ?? "claude-sonnet-4-6";
          const mode = String(body.mode ?? "plan");
          const effort = body.effort ? String(body.effort) : undefined;
          const projectId = body.projectId ? String(body.projectId) : undefined;
          if (!isAvailable("claude")) {
            sse.send({ type: "agent.error", line: "Claude CLI not found on PATH." });
            sse.close();
            return;
          }
          let prompt = rawPrompt;
          if (body.refine) {
            const r = await refineToPrd(rawPrompt, sse);
            sse.send({ type: "prd.ready", prdPrompt: r.prdPrompt, file: r.file, line: `PRD prompt drafted → ${path.basename(r.file)}. Running Claude with it…` });
            if (r.prdPrompt) prompt = r.prdPrompt;
          }

          // Agentic path (Milestone A, closes CLAUDE.md invariant 1/5): when a projectId is given,
          // hand the Director the OpenVideo MCP tools + its system prompt, restricted to ONLY our
          // server (--strict-mcp-config) so it can't pick up unrelated MCP/hook config.
          let mcpOptions: Record<string, unknown> = {};
          if (projectId) {
            let styleMd: string | undefined;
            try {
              const proj = openProject(PROJECTS_DIR, projectId);
              const styleMdPath = path.join(proj.dir, "STYLE.md");
              if (fs.existsSync(styleMdPath)) styleMd = fs.readFileSync(styleMdPath, "utf8");
            } catch {
              /* unknown project id — let the Director's own project_get call surface that */
            }
            const directorPrompt = buildDirectorSystemPrompt({
              projectId,
              mode: mode === "plan" ? "plan" : "auto",
              styleMd,
            });
            mcpOptions = {
              mcpConfigPath: MCP_CONFIG_PATH,
              strictMcpConfig: true,
              appendSystemPrompt: directorPrompt,
            };
          }

          usageTotals.sessions++;
          for await (const ev of spawnClaude({
            prompt,
            model,
            permissionMode: mode === "plan" ? "plan" : "default",
            cwd: WORKDIR,
            ...(effort ? { effort } : {}),
            ...mcpOptions,
          })) {
            if (ev.type === "usage.delta") {
              usageTotals.inputTokens += ev.inputTokens;
              usageTotals.outputTokens += ev.outputTokens;
              usageTotals.cacheReadTokens += ev.cacheReadTokens;
            }
            sse.send({ event: ev, line: friendlyTerminalLine(ev) });
            if (sse.closed) break;
          }
        } catch (e) {
          sse.send({ type: "agent.error", line: `Session failed: ${(e as Error).message}` });
        } finally {
          sse.close();
        }
        return;
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
    // freedom, no --mcp-config (ADR-0014) — the opposite of the legacy /api/session Director path
    // above. Persists the CLI's own session_id so a later tweak can --resume it.
    const mWkEdit = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/edit$/);
    if (mWkEdit && req.method === "POST") {
      const entry = workspaces.get(decodeURIComponent(mWkEdit[1]!));
      if (!entry) return json(res, 404, { error: "unknown workspace" });
      if (entry.status !== "ready" && entry.status !== "edited") {
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
        entry.status = "edited";
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
        entry.status = "edited";
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

    // ---- project routes (real media) [legacy EDD/MCP path, parked per ADR-0014] ----
    if (req.method === "GET" && url.pathname === "/api/projects") {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
      const ids = fs.existsSync(PROJECTS_DIR) ? fs.readdirSync(PROJECTS_DIR) : [];
      const projects = ids
        .map((id) => {
          const pj = path.join(PROJECTS_DIR, id, "project.json");
          if (!fs.existsSync(pj)) return null;
          try {
            return JSON.parse(fs.readFileSync(pj, "utf8"));
          } catch {
            return null;
          }
        })
        .filter((p): p is Record<string, unknown> => p !== null)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return json(res, 200, { projects });
    }

    if (req.method === "POST" && url.pathname === "/api/projects") {
      const body = await readJson(req);
      const proj = createProject(PROJECTS_DIR, { name: String(body.name ?? "untitled") });
      return json(res, 200, { id: proj.id, dir: proj.dir });
    }

    const mUpload = url.pathname.match(/^\/api\/projects\/([^/]+)\/upload$/);
    if (mUpload && req.method === "POST") {
      const proj = openProject(PROJECTS_DIR, decodeURIComponent(mUpload[1]!));
      const name = (url.searchParams.get("name") ?? "clip.mp4").replace(/[^\w.\-]/g, "_");
      const tmp = path.join(proj.dir, "downloads", name);
      fs.mkdirSync(path.dirname(tmp), { recursive: true });
      await streamToFile(req, tmp);
      const source = await ingestAsset(proj, tmp);
      const edd = scaffoldEdd(source.id, source.probe, source.path);
      saveEdd(proj, edd);
      return json(res, 200, { source, edd });
    }

    const mEdd = url.pathname.match(/^\/api\/projects\/([^/]+)\/edd$/);
    if (mEdd && req.method === "GET") {
      const proj = openProject(PROJECTS_DIR, decodeURIComponent(mEdd[1]!));
      return json(res, 200, loadEdd(proj) ?? {});
    }

    // ---- brand kit (STYLE.md, doc 14/22) ----
    const mStyle = url.pathname.match(/^\/api\/projects\/([^/]+)\/style$/);
    if (mStyle && req.method === "GET") {
      const proj = openProject(PROJECTS_DIR, decodeURIComponent(mStyle[1]!));
      const stylePath = path.join(proj.dir, "STYLE.md");
      const content = fs.existsSync(stylePath) ? fs.readFileSync(stylePath, "utf8") : "";
      return json(res, 200, { content });
    }
    if (mStyle && req.method === "POST") {
      const proj = openProject(PROJECTS_DIR, decodeURIComponent(mStyle[1]!));
      const body = await readJson(req);
      fs.writeFileSync(path.join(proj.dir, "STYLE.md"), String(body.content ?? ""));
      return json(res, 200, { ok: true });
    }

    const mRender = url.pathname.match(/^\/api\/projects\/([^/]+)\/render$/);
    if (mRender && req.method === "POST") {
      const proj = openProject(PROJECTS_DIR, decodeURIComponent(mRender[1]!));
      const edd = loadEdd(proj);
      if (!edd) return json(res, 400, { error: "project has no EDD yet" });
      const sse = openSse(res);
      const logEntry: RenderLogEntry = {
        id: randomUUID(),
        projectId: proj.id,
        status: "running",
        startedAt: new Date().toISOString(),
      };
      pushRenderLog(logEntry);
      try {
        const dag = compile(edd);
        const out = await runDAG(dag, {
          projectDir: proj.dir,
          width: edd.project.width,
          height: edd.project.height,
          fps: edd.project.fps,
          capabilities: { gpu: { nvidia: isAvailable("nvidia-smi") }, remotionCompositor: "unhealthy" },
          sources: sourcesMap(proj),
          onEvent: (e) => sse.send({ event: e, line: renderLine(e) }),
          voidExecutor,
        });
        logEntry.status = "done";
        logEntry.output = out;
        logEntry.finishedAt = new Date().toISOString();
        sse.send({ type: "render.done", output: out, line: "Render complete." });
      } catch (e) {
        logEntry.status = "error";
        logEntry.message = (e as Error).message;
        logEntry.finishedAt = new Date().toISOString();
        sse.send({ type: "error", line: `Render failed: ${(e as Error).message}` });
      } finally {
        sse.close();
      }
      return;
    }

    // ---- footage vision-analysis (doc 25 §2, claude-video, ADR-0011) ----
    const mAnalyze = url.pathname.match(/^\/api\/projects\/([^/]+)\/analyze$/);
    if (mAnalyze && req.method === "POST") {
      const proj = openProject(PROJECTS_DIR, decodeURIComponent(mAnalyze[1]!));
      const body = await readJson(req);
      const edd = loadEdd(proj);
      if (!edd) return json(res, 400, { error: "project has no EDD yet" });
      const sourceId = String(body.sourceId ?? edd.sources[0]?.id ?? "");
      const source = edd.sources.find((s) => s.id === sourceId);
      if (!source) return json(res, 400, { error: `no source "${sourceId}" on this project` });
      const videoPath = path.join(proj.dir, source.path);
      const transcriptPath = path.join(proj.dir, "transcripts", `${sourceId}.txt`);
      const transcript = fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, "utf8") : undefined;

      const sse = openSse(res);
      try {
        sse.send({ type: "analyze.start", sourceId, line: `Analyzing footage for ${sourceId}…` });
        const analysis = await analyzeFootage(videoPath, {
          sourceId,
          transcript,
          cacheDir: path.join(proj.dir, "cache", "footage-analysis"),
        });
        sse.send({ type: "analyze.done", analysis, line: `Footage analysis complete (${analysis.shots.length} shots).` });
      } catch (e) {
        sse.send({ type: "error", line: `Footage analysis failed: ${(e as Error).message}` });
      } finally {
        sse.close();
      }
      return;
    }

    // ---- transcription (doc 06 heavy tier, PRD §11) ----
    const mTranscribe = url.pathname.match(/^\/api\/projects\/([^/]+)\/transcribe$/);
    if (mTranscribe && req.method === "POST") {
      const proj = openProject(PROJECTS_DIR, decodeURIComponent(mTranscribe[1]!));
      const body = await readJson(req);
      const edd = loadEdd(proj);
      if (!edd) return json(res, 400, { error: "project has no EDD yet" });
      const sourceId = String(body.sourceId ?? edd.sources[0]?.id ?? "");
      const source = edd.sources.find((s) => s.id === sourceId);
      if (!source) return json(res, 400, { error: `no source "${sourceId}" on this project` });
      const videoPath = path.join(proj.dir, source.path);

      const sse = openSse(res);
      try {
        sse.send({ type: "transcribe.start", sourceId, line: `Transcribing ${sourceId}…` });
        const words = await transcribe(videoPath, body.model ? { model: String(body.model) } : {});

        const transcriptsDir = path.join(proj.dir, "transcripts");
        fs.mkdirSync(transcriptsDir, { recursive: true });
        fs.writeFileSync(path.join(transcriptsDir, `${sourceId}.txt`), words.map((w) => w.t).join(" "));

        const captionTrack = edd.timeline.tracks.find((t) => t.kind === "captions");
        if (captionTrack && captionTrack.kind === "captions") {
          captionTrack.words = words;
          saveEdd(proj, edd);
        }
        sse.send({ type: "transcribe.done", wordCount: words.length, line: `Transcription complete (${words.length} words).` });
      } catch (e) {
        sse.send({ type: "error", line: `Transcription failed: ${(e as Error).message}` });
      } finally {
        sse.close();
      }
      return;
    }

    // ---- library routes (doc 24 §9, ADR-0010) ----
    const mLibSearch = url.pathname.match(/^\/api\/library\/([^/]+)\/search$/);
    if (mLibSearch && req.method === "GET") {
      const kind = decodeURIComponent(mLibSearch[1]!) as ProviderKind;
      const q = url.searchParams.get("q") ?? undefined;
      const tags = url.searchParams.get("tags")?.split(",").filter(Boolean);
      const limit = url.searchParams.get("limit");
      const hits = await library.search(kind, { q, tags, limit: limit ? Number(limit) : undefined });
      const providers = library.list(kind).map((r) => ({
        id: r.provider.id,
        license: r.provider.license,
        enabled: r.enabled,
        auth: r.provider.auth,
      }));
      return json(res, 200, { hits, providers });
    }

    if (req.method === "GET" && url.pathname === "/api/library/preview") {
      const providerId = url.searchParams.get("providerId") ?? "";
      const id = url.searchParams.get("id") ?? "";
      const provider = library.get(providerId);
      if (!provider) return json(res, 404, { error: `unknown provider "${providerId}"` });
      try {
        const ref = await provider.preview(id);
        return json(res, 200, ref);
      } catch (e) {
        return json(res, 400, { error: (e as Error).message });
      }
    }

    if (req.method === "GET" && url.pathname === "/api/fonts/search") {
      const q = url.searchParams.get("q") ?? undefined;
      const hits = await library.search("font", { q });
      return json(res, 200, { hits });
    }

    const mLibInsert = url.pathname.match(/^\/api\/projects\/([^/]+)\/library\/insert$/);
    if (mLibInsert && req.method === "POST") {
      const proj = openProject(PROJECTS_DIR, decodeURIComponent(mLibInsert[1]!));
      const body = await readJson(req);
      const providerId = String(body.providerId ?? "");
      const assetId = String(body.id ?? "");
      const provider = library.get(providerId);
      if (!provider) return json(res, 404, { error: `unknown provider "${providerId}"` });
      try {
        const tmpName = `${providerId}-${assetId}`.replace(/[^\w.\-]/g, "_");
        const tmpDest = path.join(proj.dir, "downloads", tmpName);
        const file = await provider.fetch(assetId, tmpDest);
        const origin = provider.capabilities.generate ? "generated" : "provider";
        const source = addLibraryAsset(proj, file.path, {
          providerId,
          origin,
          license: file.license,
          attribution: file.attribution,
        });

        // Best-effort: patch the current EDD so the asset is immediately usable, per kind.
        const edd = loadEdd(proj);
        if (edd) {
          if (provider.kind === "font") {
            const captionTrack = edd.timeline.tracks.find((t) => t.kind === "captions");
            if (captionTrack && captionTrack.kind === "captions") captionTrack.fontRef = assetId;
          } else if (provider.kind === "music") {
            const audioTrack = edd.timeline.tracks.find((t) => t.kind === "audio");
            if (audioTrack && audioTrack.kind === "audio") {
              audioTrack.music = { src: source.id, providerId, license: file.license, attribution: file.attribution };
            }
          } else if (provider.kind === "sfx") {
            const audioTrack = edd.timeline.tracks.find((t) => t.kind === "audio");
            if (audioTrack && audioTrack.kind === "audio") {
              audioTrack.sfx = [
                ...(audioTrack.sfx ?? []),
                { cue: source.id, atS: Number(body.atS ?? 0), providerId, license: file.license },
              ];
            }
          } else {
            edd.sources.push(source);
          }
          saveEdd(proj, edd);
        }

        return json(res, 200, { source, edd });
      } catch (e) {
        return json(res, 400, { error: (e as Error).message });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/keystore") {
      const body = await readJson(req);
      const keyId = String(body.keyId ?? "");
      const value = String(body.value ?? "");
      if (!keyId || !value) return json(res, 400, { error: "keyId and value are required" });
      keystore.set(keyId, value);
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/keystore") {
      return json(res, 200, { keys: keystore.list() });
    }

    // ---- usage + render history (in-memory; Usage meter + Render Queue screens) ----
    if (req.method === "GET" && url.pathname === "/api/usage") {
      return json(res, 200, usageTotals);
    }

    if (req.method === "GET" && url.pathname === "/api/renders") {
      return json(res, 200, { renders: renderLog });
    }

    // ---- plugins (doc 15) ----
    if (req.method === "GET" && url.pathname === "/api/plugins") {
      const { plugins, errors } = discoverPlugins(PLUGINS_DIR);
      return json(res, 200, { plugins: plugins.map((p) => p.manifest), errors });
    }

    // ---- doctor (doc 06/19): a synthesized diagnostic report, composing checks already available
    // piecemeal (profile/tools, python, VOID, plugin discovery) into one pass/warn/fail list with
    // repair suggestions, instead of the user having to know which endpoint tells them what. ----
    if (req.method === "GET" && url.pathname === "/api/doctor") {
      const profile = getProfile();
      const pythonBin = resolvePythonBin();
      const voidReady = isVoidAvailable();
      const { errors: pluginErrors } = discoverPlugins(PLUGINS_DIR);

      type CheckStatus = "pass" | "warn" | "fail";
      interface Check {
        id: string;
        label: string;
        status: CheckStatus;
        detail: string;
        suggestion?: string;
      }
      const checks: Check[] = [
        {
          id: "ffmpeg",
          label: "FFmpeg / FFprobe",
          status: profile.tools.ffmpeg && profile.tools.ffprobe ? "pass" : "fail",
          detail: `ffmpeg=${profile.tools.ffmpeg ?? "missing"}, ffprobe=${profile.tools.ffprobe ?? "missing"}`,
          suggestion: "Core tier — should auto-install. If missing, install ffmpeg and ensure it's on PATH.",
        },
        {
          id: "claude",
          label: "Claude CLI",
          status: profile.tools.claude ? "pass" : "fail",
          detail: profile.tools.claude ? "present" : "not found on PATH",
          suggestion: "Required for the agentic loop. Install the Claude CLI and sign in.",
        },
        {
          id: "gpu",
          label: "NVIDIA GPU",
          status: profile.gpu.nvidia ? "pass" : "warn",
          detail: profile.gpu.nvidia ? "detected (NVENC + CUDA available)" : "not detected — CPU fallback in effect",
        },
        {
          id: "python",
          label: "Python (transcription heavy tier)",
          status: pythonBin ? "pass" : "warn",
          detail: pythonBin ?? "no interpreter found on PATH",
          suggestion: "Needed for faster-whisper transcription. Install Python 3.9+.",
        },
        {
          id: "void",
          label: "VOID object removal (heavy tier)",
          status: voidReady ? "pass" : "warn",
          detail: voidReady ? "GPU + weights present" : "GPU and/or weights not present",
          suggestion: "Approve the void-weights heavy-tier install in Settings once you need object removal.",
        },
        {
          id: "plugins",
          label: "Plugin manifests",
          status: pluginErrors.length === 0 ? "pass" : "warn",
          detail: pluginErrors.length === 0 ? "all discovered plugins are valid" : `${pluginErrors.length} plugin(s) failed to load`,
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

    // static cockpit
    if (req.method === "GET") return serveStatic(res, url.pathname);
    return json(res, 404, { error: "not found", route });
  } catch (e) {
    return json(res, 500, { error: (e as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`OpenVideo daemon listening on http://localhost:${PORT}`);
  console.log(`  cockpit:  ${COCKPIT_DIR}`);
  console.log(`  workdir:  ${WORKDIR}`);
  const p = getProfile();
  console.log(`  tools:    ffmpeg=${p.tools.ffmpeg ?? "-"} claude=${p.tools.claude ?? "-"} gpu.nvidia=${p.gpu.nvidia}`);
});
