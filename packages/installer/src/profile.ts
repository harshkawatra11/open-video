/**
 * OpenVideo — hardware/OS profile (PRD §10.2).
 *
 * The pure parsers (GPU detection, version extraction) are unit-tested; detectProfile() shells out
 * and is exercised by integration/doctor flows.
 */

import os from "node:os";
import type { Os } from "./catalog.ts";

export interface HardwareProfile {
  os: Os;
  arch: string;
  gpu: { nvidia: boolean; cudaVersion?: string };
  ramGB: number;
  freeDiskGB: number;
  /** detected tool -> version string, or null if absent. Keys include "ffmpeg","node","torch",... */
  tools: Record<string, string | null>;
}

export function currentOs(): Os {
  const p = process.platform;
  return p === "win32" ? "windows" : p === "darwin" ? "macos" : "linux";
}

/** Parse `nvidia-smi` output for presence + CUDA version. */
export function parseGpu(nvidiaSmiOutput: string | null): { nvidia: boolean; cudaVersion?: string } {
  if (!nvidiaSmiOutput) return { nvidia: false };
  const m = nvidiaSmiOutput.match(/CUDA Version:\s*([\d.]+)/i);
  if (m) return { nvidia: true, cudaVersion: m[1] };
  return { nvidia: /NVIDIA-SMI/i.test(nvidiaSmiOutput) };
}

/** Extract a version-like token from a tool's `--version` output. */
export function parseVersion(output: string | null): string | null {
  if (!output) return null;
  const m = output.match(/(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1]! : null;
}

/** Best-effort profile from the running host (RAM/arch from os; tools/GPU filled by the daemon). */
export function baseProfile(): Pick<HardwareProfile, "os" | "arch" | "ramGB"> {
  return {
    os: currentOs(),
    arch: process.arch,
    ramGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
  };
}
