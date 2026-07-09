/** OpenVideo — encoder + render-path selection, and the color-grade filter (Appendix B §5). */

import type { RenderCapabilities } from "./context.ts";
import type { Effect } from "@openvideo/edd";

/** GPU when present (NVENC), CPU fallback always (PRD §15.5). */
export function selectVideoEncoder(cap: RenderCapabilities): string {
  return cap.gpu.nvidia ? "h264_nvenc" : "libx264";
}

/** ADR-0006: use the native Remotion compositor only when it is known-healthy; else PNG-sequence. */
export function selectRenderPath(cap: RenderCapabilities): "native" | "pngseq" {
  return cap.remotionCompositor === "healthy" ? "native" : "pngseq";
}

/**
 * Build the color filter chain from the EDD color effect (Appendix B §5):
 * HLG/HDR -> Rec.709 SDR tonemap + a tasteful grade. Returns "null" (passthrough) if no color spec.
 */
export function gradeFilter(effects: Effect[]): string {
  const color = effects.find((e) => e.type === "color");
  const spec = (color?.spec ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  if (spec.tonemap === "hlg_to_bt709") {
    parts.push(
      "zscale=t=linear:npl=100",
      "format=gbrpf32le",
      "zscale=p=bt709",
      "tonemap=hable:desat=0",
      "zscale=t=bt709:m=bt709:r=tv",
      "format=yuv420p",
    );
  }
  if (spec.wb === "neutralize") parts.push("colorbalance=rm=-0.02:bm=0.02");
  if (spec.contrast === "s_curve_light") parts.push("curves=preset=medium_contrast");
  if (typeof spec.vibrance === "number") parts.push(`vibrance=intensity=${spec.vibrance}`);
  if (typeof spec.sharpen === "number") parts.push(`unsharp=5:5:${spec.sharpen}`);

  return parts.length > 0 ? parts.join(",") : "null";
}
