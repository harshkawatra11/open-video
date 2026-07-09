/**
 * OpenVideo — spawn the Claude CLI headless (ADR-0002, Appendix C §1).
 *
 * buildClaudeArgs + createLineBuffer are pure and unit-tested. spawnClaude streams the CLI's
 * stdout, splits lines, parses each as stream-json, and yields normalized protocol Events; it is
 * exercised by integration smoke tests against the real binary (not in unit tests).
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Event, ModelId } from "@openvideo/shared";
import { parseClaudeEvent } from "./parse.ts";

/** Override the binary via env for testing/packaging. */
export const CLAUDE_BIN = process.env.OPENVIDEO_CLAUDE_BIN ?? "claude";

/** What to actually spawn: a direct, natively-executable target — never a `.cmd`/`.bat` shim (Node
 *  refuses those without `shell:true`, and `shell:true` with a user-controlled prompt in argv is a
 *  command-injection risk we will not accept). `argsPrefix` holds extra leading args when the real
 *  target is a script that must be run through an interpreter (e.g. `node script.js`). */
export interface ResolvedBin {
  command: string;
  argsPrefix: string[];
}

/** Resolves a bare command to a directly-spawnable target (mirrors @openvideo/render's resolveBin's
 *  extension-order fix, duplicated here rather than depended-on so cli-adapter stays the sole,
 *  minimal point of CLI coupling). On win32, npm installs a POSIX shebang shim (extensionless — not a
 *  native PE executable, must never be spawned directly) alongside a `.cmd` shim that just forwards
 *  to the real target; we read the `.cmd` and follow it to that real `.exe`/`.js` rather than
 *  spawning the shim itself. */
export function resolveClaudeBin(name: string): ResolvedBin {
  if (path.isAbsolute(name) && existsSync(name)) return followIfShim(name);
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (existsSync(candidate)) return followIfShim(candidate);
    }
  }
  return { command: name, argsPrefix: [] };
}

/** npm's Windows `.cmd` shims are a fixed, well-known template ending in a single quoted target path
 *  (using the batch variable `%dp0%` for "this .cmd's own directory") followed by `%*` — extract that
 *  target, expand `%dp0%` ourselves (cmd.exe would set it to the shim's own directory, trailing
 *  backslash included), and if it's a `.js` file, run it via this same Node binary (a real PE
 *  executable, always safe to spawn directly). */
function followIfShim(candidate: string): ResolvedBin {
  if (!/\.cmd$/i.test(candidate)) return { command: candidate, argsPrefix: [] };
  try {
    const contents = readFileSync(candidate, "utf8");
    const m = contents.match(/"([^"]+\.(?:exe|js))"/i);
    if (!m) return { command: candidate, argsPrefix: [] };
    const dp0 = path.dirname(candidate) + path.sep;
    const target = path.normalize(m[1]!.replace(/%dp0%/gi, dp0));
    if (/\.js$/i.test(target)) return { command: process.execPath, argsPrefix: [target] };
    return { command: target, argsPrefix: [] };
  } catch {
    return { command: candidate, argsPrefix: [] };
  }
}

export interface SpawnOptions {
  prompt: string;
  model: ModelId;
  /** resume an existing CLI session by id. */
  resume?: string;
  /** logical session id to stamp on emitted events (defaults to resume id). */
  sessionId?: string;
  mcpConfigPath?: string;
  /** Only load MCP servers from --mcp-config, ignoring the user/project's own MCP configuration
   *  (e.g. this repo's dev-session hooks/skills) — keeps an OpenVideo session's toolset exactly the
   *  MCP server we spawned, nothing more. */
  strictMcpConfig?: boolean;
  /** e.g. "plan" | "acceptEdits" | "default". */
  permissionMode?: string;
  cwd?: string;
  /** Effort level for the session (CLI: --effort). e.g. "low" | "medium" | "high" | "xhigh" | "max". */
  effort?: string;
  /** Appended to the CLI's default system prompt (CLI: --append-system-prompt) — this is how the
   *  Director's system prompt (@openvideo/agents) is attached to a session. */
  appendSystemPrompt?: string;
  /** stream JSON messages in on stdin (interactive multi-turn). Off => one-shot prompt. */
  streamInput?: boolean;
}

export function buildClaudeArgs(o: SpawnOptions): string[] {
  const args = ["-p", o.prompt, "--output-format", "stream-json"];
  if (o.streamInput) args.push("--input-format", "stream-json");
  args.push("--verbose", "--model", o.model); // --verbose required by the CLI for stream-json + -p
  if (o.effort) args.push("--effort", o.effort);
  if (o.resume) args.push("--resume", o.resume);
  if (o.mcpConfigPath) args.push("--mcp-config", o.mcpConfigPath);
  if (o.strictMcpConfig) args.push("--strict-mcp-config");
  if (o.permissionMode) args.push("--permission-mode", o.permissionMode);
  if (o.appendSystemPrompt) args.push("--append-system-prompt", o.appendSystemPrompt);
  return args;
}

/** Incremental newline splitter for streamed stdout chunks. */
export function createLineBuffer() {
  let buf = "";
  return {
    push(chunk: string): string[] {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      return lines.map((l) => l.trim()).filter((l) => l.length > 0);
    },
    flush(): string[] {
      const rest = buf.trim();
      buf = "";
      return rest.length > 0 ? [rest] : [];
    },
  };
}

/** Spawn the CLI and yield normalized Events. Integration-tested against the real binary. */
export async function* spawnClaude(o: SpawnOptions): AsyncGenerator<Event> {
  const { command, argsPrefix } = resolveClaudeBin(CLAUDE_BIN);
  const child = spawn(command, [...argsPrefix, ...buildClaudeArgs(o)], {
    cwd: o.cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const lb = createLineBuffer();
  const sid = o.sessionId ?? o.resume ?? "session";

  if (child.stdout) {
    child.stdout.setEncoding("utf8");
    for await (const chunk of child.stdout) {
      for (const line of lb.push(String(chunk))) {
        yield* tryParse(line, sid);
      }
    }
  }
  for (const line of lb.flush()) yield* tryParse(line, sid);
}

function* tryParse(line: string, sessionId: string): Generator<Event> {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return; // non-JSON log line — ignore
  }
  for (const ev of parseClaudeEvent(json, sessionId)) yield ev;
}
