/**
 * OpenVideo — VOID adapter (doc 25 §3, ADR-0011). Wraps the VOID inference (CogVideoX + SAM2/3)
 * behind a typed spec. Heavy tier: weights install on first use with consent (Installation Agent
 * catalog entry "void-weights", ADR-0004); GPU-bound (CPU path is impractical, so we don't offer it).
 *
 * This machine has neither the weights nor (necessarily) the entry-point installed, so `removeObject`
 * is expected to throw `VoidNotInstalledError` / `VoidRequiresGpuError` until the Installer has run —
 * that is the honest, correct behavior for a heavy/tiered integration, not a bug to hide.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { isAvailable, resolveBin } from "@openvideo/render";
import type { RemoveObjectRegion, RemoveObjectResult, RemoveObjectSpec } from "./types.ts";

export class VoidRequiresGpuError extends Error {
  constructor() {
    super("VOID requires an NVIDIA GPU (CogVideoX/SAM2/3 are GPU-bound) — no GPU was detected.");
    this.name = "VoidRequiresGpuError";
  }
}

export class VoidNotInstalledError extends Error {
  constructor(weightsDir: string) {
    super(`VOID weights are not installed at "${weightsDir}" — approve the heavy-tier install first (Settings → Installer).`);
    this.name = "VoidNotInstalledError";
  }
}

export interface VoidEnv {
  weightsDir?: string;
  /** The VOID inference entry point (a Python script/CLI shim) — resolved via PATH by default. */
  bin?: string;
}

function defaultWeightsDir(): string {
  return process.env.OPENVIDEO_VOID_WEIGHTS_DIR ?? path.join(process.env.OPENVIDEO_WORKDIR ?? "", "models", "void");
}

/** True iff a GPU is present AND the weights directory looks populated. Pure/sync — cheap enough to
 *  call before every removeObject() and to surface directly in the VFX panel's enabled/disabled state. */
export function isVoidAvailable(env: VoidEnv = {}): boolean {
  const gpu = isAvailable("nvidia-smi");
  const weightsDir = env.weightsDir ?? defaultWeightsDir();
  const hasWeights = weightsDir.length > 0 && fs.existsSync(weightsDir) && fs.readdirSync(weightsDir).length > 0;
  return gpu && hasWeights;
}

/** Pure: builds the argv for the VOID inference entry point (offline-testable regardless of whether
 *  VOID is actually installed on this machine). */
export function buildVoidInferenceArgs(spec: RemoveObjectSpec, outPath: string, weightsDir: string): string[] {
  const args = [
    "--weights",
    weightsDir,
    "--input",
    spec.clipPath,
    "--output",
    outPath,
    "--start",
    String(spec.atS[0]),
    "--end",
    String(spec.atS[1]),
  ];
  if (spec.region) {
    const r: RemoveObjectRegion = spec.region;
    args.push("--region", `${r.x},${r.y},${r.w},${r.h}`);
  }
  if (spec.maskPath) args.push("--mask", spec.maskPath);
  if (spec.prompt) args.push("--prompt", spec.prompt);
  return args;
}

/** Removes an object/person/logo from a clip range via VOID. Throws honestly if the GPU or weights
 *  aren't present rather than silently no-op'ing (this machine currently has neither installed, so
 *  this path is integration-gated exactly like the render executor's real-ffmpeg tests). */
export async function removeObject(spec: RemoveObjectSpec, outPath: string, env: VoidEnv = {}): Promise<RemoveObjectResult> {
  if (!isAvailable("nvidia-smi")) throw new VoidRequiresGpuError();
  const weightsDir = env.weightsDir ?? defaultWeightsDir();
  if (!fs.existsSync(weightsDir) || fs.readdirSync(weightsDir).length === 0) {
    throw new VoidNotInstalledError(weightsDir);
  }
  const bin = env.bin ?? "void-infer";
  const args = buildVoidInferenceArgs(spec, outPath, weightsDir);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(resolveBin(bin), args, { windowsHide: true });
    let stderr = "";
    child.stderr?.on("data", (d) => (stderr += String(d)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`void-infer exited ${code}: ${stderr.slice(-800)}`))));
  });
  return { outputPath: outPath };
}
