/**
 * OpenVideo — Intermediate Representation (IR).
 *
 * The EDD is intent-level and partly abstract; lowering normalizes it into this concrete, typed,
 * frame-exact IR (PRD §12.4). The IR is the unit the compiler passes operate on and the input to
 * execution-DAG codegen (PRD §12.6). It is resolution-independent where possible so preview and
 * final share it.
 *
 * Erasable TypeScript (types only).
 */

import type { ProjectMeta, ExportSpec, TrackKind } from "./types.ts";

export interface IR {
  schemaVersion: string;
  project: ProjectMeta;
  fps: number;
  durationFrames: number;
  tracks: IRTrack[];
  exportSpec: ExportSpec;
}

export interface IRTrack {
  id: string;
  kind: TrackKind;
  ops: IROp[];
}

export type IROp = ClipOp | CaptionOp | GraphicOp | AudioOp | BrollOp;

export interface Keyframe {
  frame: number;
  value: number;
  ease: string;
}

export interface ClipOp {
  op: "clip";
  clipId: string;
  src: string;
  inFrame: number;
  outFrame: number;
  /** Expanded scale curve (the lowered punch-in); always >= 1 keyframe. */
  scale: Keyframe[];
}

export interface CaptionOp {
  op: "caption";
  text: string;
  startFrame: number;
  endFrame: number;
  emph: boolean;
}

export interface GraphicOp {
  op: "graphic";
  id: string;
  component: string;
  props: Record<string, unknown>;
  startFrame: number;
  endFrame: number;
}

export interface AudioOp {
  op: "audio";
  voiceChain: string[];
  targetLUFS: number | null;
  tpDb: number | null;
  music: { src: string | null; targetLUFS: number | null; duck: string | null };
  sfx: Array<{ cue: string; atFrame: number }>;
}

/** A b-roll clip composited over the a-roll during [startFrame,endFrame] on the main timeline (doc 24
 *  §5). `inFrame`/`outFrame` select the range within the b-roll source itself. */
export interface BrollOp {
  op: "broll";
  clipId: string;
  src: string;
  inFrame: number;
  outFrame: number;
  startFrame: number;
  endFrame: number;
  opacity: number;
}
