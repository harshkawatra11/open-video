/**
 * OpenVideo — dependency catalog + capability map (PRD §10.3, ADR-0004).
 *
 * CORE tier auto-installs silently on first run; HEAVY tier installs on first use with consent.
 * Data-driven so plugins can extend it (PRD §10.3).
 */

export type Tier = "core" | "heavy";
export type Os = "windows" | "macos" | "linux";
export type Method = "winget" | "choco" | "pip" | "pnpm" | "download" | "bundled";

export interface Dep {
  id: string;
  tier: Tier;
  approxMB: number;
  purpose: string;
  /** if set, only applies when an NVIDIA GPU is present. */
  requiresNvidia?: boolean;
  /** key to look up in the hardware profile's `tools` map (defaults to id). */
  toolKey?: string;
  /** per-OS install method (Windows-first; others fill in later — ADR-0007). */
  methods?: Partial<Record<Os, Method>>;
}

export const CATALOG: Record<string, Dep> = {
  ffmpeg: { id: "ffmpeg", tier: "core", approxMB: 90, purpose: "media render/inspection workhorse", methods: { windows: "winget" } },
  "yt-dlp": { id: "yt-dlp", tier: "core", approxMB: 30, purpose: "authorized media import", methods: { windows: "winget" } },
  node: { id: "node", tier: "core", approxMB: 60, purpose: "Remotion + tooling runtime", methods: { windows: "winget" } },
  pnpm: { id: "pnpm", tier: "core", approxMB: 10, purpose: "workspace package manager", methods: { windows: "winget" } },
  remotion: { id: "remotion", tier: "core", approxMB: 120, purpose: "graphics/captions engine", methods: { windows: "pnpm" } },

  python: { id: "python", tier: "heavy", approxMB: 60, purpose: "host for Whisper/torch (pinned toolchain)", methods: { windows: "bundled" } },
  "torch-cpu": { id: "torch-cpu", tier: "heavy", approxMB: 200, purpose: "ASR compute (CPU)", toolKey: "torch", methods: { windows: "pip" } },
  "torch-cuda": { id: "torch-cuda", tier: "heavy", approxMB: 2500, purpose: "ASR compute (CUDA)", toolKey: "torch", requiresNvidia: true, methods: { windows: "pip" } },
  "cuda-runtime": { id: "cuda-runtime", tier: "heavy", approxMB: 1500, purpose: "GPU runtime for ASR/encode", requiresNvidia: true, methods: { windows: "bundled" } },
  whisper: { id: "whisper", tier: "heavy", approxMB: 20, purpose: "speech-to-text", methods: { windows: "pip" } },
  "whisper-weights": { id: "whisper-weights", tier: "heavy", approxMB: 1500, purpose: "ASR model weights", methods: { windows: "download" } },
  imagemagick: { id: "imagemagick", tier: "heavy", approxMB: 50, purpose: "image ops for some plugins", methods: { windows: "winget" } },

  // VOID — interaction-aware object removal (doc 25 §3, ADR-0011). GPU-bound; CPU path impractical.
  "void-weights": {
    id: "void-weights",
    tier: "heavy",
    approxMB: 6000,
    purpose: "VOID object-removal model weights (CogVideoX + SAM2/3)",
    requiresNvidia: true,
    methods: { windows: "download" },
  },
};

/** Capability -> logical dependency ids ("torch" resolves to a cpu/cuda variant at plan time). */
export const CAPABILITY_DEPS: Record<string, string[]> = {
  probe: ["ffmpeg"],
  import: ["yt-dlp"],
  render_reel: ["ffmpeg", "node", "pnpm", "remotion"],
  transcribe: ["python", "torch", "cuda-runtime", "whisper", "whisper-weights"],
  vfx_remove_object: ["python", "torch-cuda", "cuda-runtime", "void-weights"],
};
