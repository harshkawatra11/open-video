/**
 * OpenVideo — Remotion overlay render builder (PRD §15.4, ADR-0006).
 *
 * Renders the captions+graphics as a transparent layer. Native mode -> alpha .mov directly. When the
 * native compositor is not known-healthy, fall back to a transparent PNG sequence (headless Chrome,
 * which worked in the PoC when the native compositor crashed) and assemble it to .mov with FFmpeg.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { outPath } from "./context.ts";
import { selectRenderPath } from "./encoder.ts";
import type { ToolContext, RemotionPlan } from "./context.ts";
import type { DAGNode } from "@openvideo/compiler";

/** The real Overlay composition's entry point (packages/remotion). Resolved once via Node's own
 *  module resolution — @openvideo/remotion is a real dependency of this package, not a bare command
 *  on PATH, so there's no shim/PATH ambiguity here (unlike the Claude CLI case in cli-adapter). */
const REMOTION_ENTRY = fileURLToPath(import.meta.resolve("@openvideo/remotion"));

/** How many zero-padded digits Remotion's own `--sequence` output uses for a given frame count (it
 *  sizes the padding to the highest frame index, e.g. "element-00.png".."element-59.png" for 60
 *  frames — NOT a fixed 4 digits). Getting this wrong means the ffmpeg assemble step silently can't
 *  find any input frames. */
export function sequenceDigitWidth(durationFrames: number): number {
  return Math.max(1, String(Math.max(0, durationFrames - 1)).length);
}

export function planOverlay(node: DAGNode, ctx: ToolContext): RemotionPlan {
  const mode = selectRenderPath(ctx.capabilities);
  const out = outPath(ctx, node);
  const composition = "Overlay";
  const props = node.params;

  if (mode === "native") {
    const cliArgs = ["render", REMOTION_ENTRY, composition, out, "--codec=prores", "--pixel-format=yuva444p10le"];
    return { kind: "remotion", nodeId: node.id, mode, composition, props, outPath: out, cliArgs };
  }

  const pngSeqDir = path.join(ctx.projectDir, "cache", "seq", node.key);
  const cliArgs = ["render", REMOTION_ENTRY, composition, pngSeqDir, "--sequence", "--image-format=png"];
  const digits = sequenceDigitWidth(Number(props.durationFrames ?? 1));
  const assembleArgs = [
    "-y", "-framerate", String(ctx.fps), "-i", path.join(pngSeqDir, `element-%0${digits}d.png`),
    "-c:v", "prores_ks", "-pix_fmt", "yuva444p10le", out,
  ];
  return { kind: "remotion", nodeId: node.id, mode, composition, props, outPath: out, cliArgs, assembleArgs, pngSeqDir };
}
