/**
 * @openvideo/render — build concrete FFmpeg/Remotion execution specs from DAG nodes (PRD §15).
 * Pure builders; the daemon executes the specs. Pixel correctness is validated later with media.
 */

export type * from "./context.ts";
export { outPath } from "./context.ts";
export { selectVideoEncoder, selectRenderPath, gradeFilter } from "./encoder.ts";
export {
  planCut,
  planGrade,
  planLevelAudio,
  planLevelAudioMeasure,
  planComposite,
  planEncode,
} from "./ffmpeg.ts";
export type { LoudnormStats } from "./ffmpeg.ts";
export { planOverlay, sequenceDigitWidth } from "./remotion.ts";
export { planVfx } from "./vfx.ts";
export { planNode, planDAG } from "./plan.ts";
export { runFfmpeg, runFfprobe, runRemotion, resolveBin, isAvailable, FFMPEG_BIN, FFPROBE_BIN } from "./execute.ts";
export { runDAG } from "./run-dag.ts";
export type { RunOptions, RunEvent } from "./run-dag.ts";
