/**
 * OpenVideo — FFmpeg command builders (Appendix B). Each returns a typed argv (never a raw shell
 * string), satisfying the CLAUDE.md invariant that privileged media ops go through typed specs.
 */

import { outPath } from "./context.ts";
import { selectVideoEncoder, gradeFilter } from "./encoder.ts";
import type { ToolContext, FfmpegPlan } from "./context.ts";
import type { DAGNode } from "@openvideo/compiler";
import type { Effect } from "@openvideo/edd";

interface ClipParam {
  clipId: string;
  src: string;
  inFrame: number;
  outFrame: number;
  scale: Array<{ frame: number; value: number; ease: string }>;
}

/** Loudnorm stats from the measure pass (Appendix B §4). */
export interface LoudnormStats {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
}

/**
 * Encoder-specific preset. OPENVIDEO_PRESET is a *speed tier* ("fast" | "final", default "final").
 * libx264 uses ultrafast..slow; NVENC uses named presets (fast/slow) — "ultrafast" is x264-only and
 * errors on NVENC, so the tier is mapped per encoder.
 */
function presetFor(encoder: string): string {
  const tier = (process.env.OPENVIDEO_PRESET ?? "final").toLowerCase();
  const fast = tier === "fast" || tier === "ultrafast" || tier === "preview";
  if (encoder === "h264_nvenc" || encoder === "hevc_nvenc") return fast ? "fast" : "slow";
  return fast ? "ultrafast" : "slow"; // libx264
}

const resolve0 = (ctx: ToolContext, node: DAGNode): string => ctx.resolveInput(node.inputs[0] ?? "");

/** cut: trim each clip from the source and concat (Appendix B §7/§8 assembly). */
export function planCut(node: DAGNode, ctx: ToolContext): FfmpegPlan {
  const clips = (node.params.clips as ClipParam[]) ?? [];
  const src = resolve0(ctx, node);
  const segs: string[] = [];
  const labels: string[] = [];
  clips.forEach((c, i) => {
    const lbl = `c${i}`;
    segs.push(`[0:v]trim=start_frame=${c.inFrame}:end_frame=${c.outFrame},setpts=PTS-STARTPTS[${lbl}]`);
    labels.push(`[${lbl}]`);
  });
  const filter = [...segs, `${labels.join("")}concat=n=${clips.length}:v=1:a=0[v]`].join(";");
  const enc = selectVideoEncoder(ctx.capabilities);
  const args = [
    "-y", "-i", src, "-filter_complex", filter, "-map", "[v]", "-an",
    "-c:v", enc, "-crf", "18", "-preset", presetFor(enc), "-pix_fmt", "yuv420p", outPath(ctx, node),
  ];
  return { kind: "ffmpeg", nodeId: node.id, args, output: node.output };
}

/** tonemap_grade: HLG/HDR -> SDR tonemap + grade (Appendix B §5). */
export function planGrade(node: DAGNode, ctx: ToolContext): FfmpegPlan {
  const input = resolve0(ctx, node);
  const effects = (node.params.effects as Effect[]) ?? [];
  const vf = gradeFilter(effects);
  const enc = selectVideoEncoder(ctx.capabilities);
  const args = [
    "-y", "-i", input, "-vf", vf,
    "-c:v", enc, "-crf", "18", "-preset", presetFor(enc), "-pix_fmt", "yuv420p", outPath(ctx, node),
  ];
  return { kind: "ffmpeg", nodeId: node.id, args, output: node.output };
}

/** level_audio pass 1 — measure loudness (Appendix B §4). Returns argv for the measure run. */
export function planLevelAudioMeasure(node: DAGNode, ctx: ToolContext): string[] {
  const input = resolve0(ctx, node);
  const t = (node.params.targetLUFS as number) ?? -14;
  return ["-i", input, "-af", `loudnorm=I=${t}:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"];
}

/** level_audio pass 2 — apply gentle denoise + two-pass loudnorm (Appendix B §4). */
export function planLevelAudio(node: DAGNode, ctx: ToolContext, measured?: LoudnormStats): FfmpegPlan {
  const input = resolve0(ctx, node);
  const t = (node.params.targetLUFS as number) ?? -14;
  let ln = `loudnorm=I=${t}:TP=-1.5:LRA=11`;
  if (measured) {
    ln +=
      `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
      `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:linear=true`;
  }
  const af = `afftdn=nr=10:nf=-25,${ln}`;
  const args = ["-y", "-i", input, "-af", af, "-c:a", "pcm_s16le", "-ar", "48000", outPath(ctx, node)];
  return { kind: "ffmpeg", nodeId: node.id, args, output: node.output };
}

interface BrollLayerParam {
  startFrame: number;
  endFrame: number;
  opacity: number;
}

/** ffmpeg_compose: layer the graded a-roll, any timed b-roll cutaways (doc 24 §5), and the alpha
 *  graphics/captions overlay into one frame (Appendix B §10). Input order (fixed by the compiler,
 *  packages/compiler/src/compile.ts): [...gradeIds, ...brollLayerIds, overlay?]. With a single input
 *  (nothing to layer) it degrades to a passthrough re-encode. */
export function planComposite(node: DAGNode, ctx: ToolContext): FfmpegPlan {
  const inputs = node.inputs.map((id) => ctx.resolveInput(id));
  const enc = selectVideoEncoder(ctx.capabilities);

  if (inputs.length <= 1) {
    const args = [
      "-y", "-i", inputs[0] ?? "", "-an",
      "-c:v", enc, "-crf", "18", "-preset", presetFor(enc), "-pix_fmt", "yuv420p", outPath(ctx, node),
    ];
    return { kind: "ffmpeg", nodeId: node.id, args, output: node.output };
  }

  const fps = Number(node.params.fps ?? ctx.fps);
  const width = Number(node.params.width ?? ctx.width);
  const height = Number(node.params.height ?? ctx.height);
  const brollLayers = (node.params.brollLayers as BrollLayerParam[]) ?? [];
  const hasOverlay = Boolean(node.params.hasOverlay);

  const inputArgs: string[] = [];
  for (const inp of inputs) inputArgs.push("-i", inp);

  const filters: string[] = [];
  let current = "0:v";
  let idx = 1;
  for (const layer of brollLayers) {
    const startS = (layer.startFrame / fps).toFixed(3);
    const endS = (layer.endFrame / fps).toFixed(3);
    const scaled = `bs${idx}`;
    filters.push(`[${idx}:v]scale=${width}:${height}[${scaled}]`);
    let layerLabel = scaled;
    if (layer.opacity < 1) {
      const alpha = `ba${idx}`;
      filters.push(`[${scaled}]format=yuva420p,colorchannelmixer=aa=${layer.opacity}[${alpha}]`);
      layerLabel = alpha;
    }
    const outLabel = `bo${idx}`;
    filters.push(`[${current}][${layerLabel}]overlay=enable='between(t,${startS},${endS})'[${outLabel}]`);
    current = outLabel;
    idx++;
  }
  if (hasOverlay) {
    filters.push(`[${current}][${idx}:v]overlay=0:0[v]`);
    current = "v";
  }

  const args = [
    "-y", ...inputArgs,
    "-filter_complex", filters.join(";"),
    "-map", `[${current}]`, "-an",
    "-c:v", enc, "-crf", "18", "-preset", presetFor(enc), "-pix_fmt", "yuv420p", outPath(ctx, node),
  ];
  return { kind: "ffmpeg", nodeId: node.id, args, output: node.output };
}

/** encode: final platform-optimized mux + encode (Appendix B §10/§11). */
export function planEncode(node: DAGNode, ctx: ToolContext): FfmpegPlan {
  const inputs = node.inputs.map((id) => ctx.resolveInput(id));
  const video = inputs[0] ?? "";
  const audio = inputs[1];
  const p = node.params as Record<string, unknown>;
  const enc = selectVideoEncoder(ctx.capabilities);
  const crf = String((p.crf as number) ?? 18);
  const fps = String((p.fps as number) ?? ctx.fps);
  const w = (p.w as number) ?? ctx.width;
  const h = (p.h as number) ?? ctx.height;

  const args = ["-y", "-i", video];
  if (audio) args.push("-i", audio);
  args.push("-map", "0:v");
  if (audio) args.push("-map", "1:a");
  args.push("-c:v", enc, "-crf", crf, "-preset", presetFor(enc), "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", fps, "-s", `${w}x${h}`);
  if (audio) args.push("-c:a", "aac", "-b:a", "192k", "-ar", "48000");
  if (p.faststart !== false) args.push("-movflags", "+faststart");
  args.push(outPath(ctx, node));
  return { kind: "ffmpeg", nodeId: node.id, args, output: node.output };
}
