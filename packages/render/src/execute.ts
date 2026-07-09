/**
 * OpenVideo — tool execution (PRD §15). Spawns the real ffmpeg/ffprobe/remotion. The daemon is the
 * only privileged process that calls this; agents never get a raw shell (CLAUDE.md invariant 5).
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import type { RemotionPlan } from "./context.ts";

/** Resolves the real @remotion/cli entry script via Node's own module resolution — @remotion/cli is
 *  a declared dependency of this package, so there's no PATH/shim ambiguity to handle (contrast with
 *  cli-adapter's resolveClaudeBin, which has to follow a Windows .cmd shim because the Claude CLI is
 *  a globally-installed system binary, not one of our own npm dependencies). */
function resolveRemotionCliEntry(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@remotion/cli/package.json");
  return path.join(path.dirname(pkgPath), "remotion-cli.js");
}

export const FFMPEG_BIN = process.env.OPENVIDEO_FFMPEG_BIN ?? "ffmpeg";
export const FFPROBE_BIN = process.env.OPENVIDEO_FFPROBE_BIN ?? "ffprobe";

/** Resolve a bare command name to an absolute path by scanning PATH (Windows-safe: tries .exe/.cmd
 *  BEFORE the extensionless name — npm installs both a POSIX shebang shim (extensionless, not a
 *  native PE executable) and a Windows .cmd shim for the same command name; on win32 the
 *  extensionless one must never win or `spawn()` fails with ENOENT despite the "binary" resolving to
 *  an existing file). */
export function resolveBin(name: string): string {
  if (path.isAbsolute(name) && existsSync(name)) return name;
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return name;
}

export function isAvailable(name: string): boolean {
  return path.isAbsolute(resolveBin(name));
}

function run(bin: string, args: string[], opts: { shell?: boolean } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveBin(bin), args, { windowsHide: true, shell: opts.shell ?? false });
    let err = "";
    child.stderr?.on("data", (d) => {
      err += String(d);
      if (err.length > 20000) err = err.slice(-20000);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}: ${err.slice(-800)}`)),
    );
  });
}

export function runFfmpeg(args: string[]): Promise<void> {
  return run(FFMPEG_BIN, args);
}

export function runFfprobe(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveBin(FFPROBE_BIN), args, { windowsHide: true });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => (out += String(d)));
    child.stderr?.on("data", (d) => (err += String(d)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`ffprobe exited ${code}: ${err.slice(-400)}`))));
  });
}

/** Real Remotion execution (integration-only). Native -> render .mov directly; pngseq -> render a PNG
 *  sequence + ffmpeg-assemble it into the alpha .mov (ADR-0006's proven fallback — the native
 *  compositor is known to crash under some configs, confirmed again while building this). Spawns
 *  `node <remotion-cli.js> ...` directly (never a bare "remotion"/shell) and writes the node's props
 *  to a real JSON file for `--props=`, since RemotionPlan.props must stay a plain, pure, unwritten
 *  value for planOverlay to remain testable without touching the filesystem. */
export async function runRemotion(plan: RemotionPlan): Promise<void> {
  const entry = resolveRemotionCliEntry();
  const propsDir = path.join(os.tmpdir(), "openvideo-remotion-props");
  mkdirSync(propsDir, { recursive: true });
  const propsPath = path.join(propsDir, `${plan.nodeId}.json`);
  writeFileSync(propsPath, JSON.stringify(plan.props));

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...plan.cliArgs, `--props=${propsPath}`], { windowsHide: true });
    let err = "";
    child.stderr?.on("data", (d) => {
      err += String(d);
      if (err.length > 20000) err = err.slice(-20000);
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`remotion render exited ${code}: ${err.slice(-1200)}`))));
  });

  if (plan.assembleArgs) await runFfmpeg(plan.assembleArgs);
}
