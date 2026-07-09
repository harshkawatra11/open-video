/** Run `pnpm install` inside a scaffolded workspace's remotion/ dir. Separate from scaffoldWorkspace
 *  because it's slow (network + postinstall) and callers may want to stream progress. */

import { spawn } from "node:child_process";

export interface InstallProgress {
  chunk: string;
}

export function installRemotionDeps(remotionDir: string, onProgress?: (p: InstallProgress) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    // Windows: pnpm is a .cmd shim; Node's spawn() cannot exec a .cmd directly without shell:true
    // (EINVAL otherwise — the same class of issue cli-adapter's resolveClaudeBin works around for
    // the Claude CLI). Safe here because argv is fixed ("install"), never user-controlled text.
    const child = spawn("pnpm", ["install"], {
      cwd: remotionDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    child.stdout.on("data", (d: Buffer) => onProgress?.({ chunk: d.toString() }));
    child.stderr.on("data", (d: Buffer) => onProgress?.({ chunk: d.toString() }));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm install failed in ${remotionDir} (exit ${code})`));
    });
  });
}
