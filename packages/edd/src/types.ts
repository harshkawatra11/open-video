/**
 * OpenVideo — Edit Decision Document (EDD) = the Video AST.
 *
 * The EDD is the typed, JSON, git-versioned, intent-bearing description of an edit. It is the
 * contract between the reasoning plane (agents author/patch it) and the execution plane (the
 * compiler lowers it to IR -> execution DAG -> render).
 *
 * Authoritative shape: PRD §13.2 and docs/appendices/D-data-schema-reference.md §1.
 * Keep this file "erasable" TypeScript (interfaces/type-aliases only) so Node can run it directly.
 */

export type Id = string;

/** Top-level Edit Decision Document. */
export interface EDD {
  schemaVersion: string;
  id: Id;
  project: ProjectMeta;
  sources: Source[];
  timeline: Timeline;
  export: ExportSpec;
  /** Per-node attribution: which agent authored a node and why (PRD §12.3). */
  provenance?: Provenance[];
}

export interface ProjectMeta {
  id: Id;
  width: number;
  height: number;
  fps: number;
  /** e.g. "bt709" (SDR default) or "hlg/bt2020" for HDR sources. */
  colorSpace: string;
  /** e.g. "instagram_reel", "tiktok", "youtube_short". */
  platform: string;
  /** Reference into the project STYLE.md (look system), e.g. "STYLE.md@<gitsha>". */
  styleRef?: string;
}

export interface Source {
  id: Id;
  path: string;
  /** sha256 content hash — identity for dedupe + cache keys (PRD §17.4). */
  hash?: string;
  probe?: Probe;
  /** Provenance for library-sourced assets (doc 24 §7, copyright-safety PRD §4.3): user footage has
   *  no origin set; provider/generated assets always carry it so it's auditable end to end. */
  origin?: "user" | "provider" | "generated";
  providerId?: string;
  license?: string;
  attribution?: string;
}

export interface Probe {
  durationS: number;
  w: number;
  h: number;
  fps: number;
  vcodec?: string;
  acodec?: string;
  /** e.g. "hlg/bt2020", "bt709". */
  color?: string;
}

export interface Timeline {
  durationS: number;
  tracks: Track[];
}

export type TrackKind = "video" | "captions" | "graphics" | "audio" | "broll";

export type Track = VideoTrack | CaptionTrack | GraphicsTrack | AudioTrack | BrollTrack;

export interface VideoTrack {
  id: Id;
  kind: "video";
  clips: Clip[];
  transitions?: Transition[];
  effects?: Effect[];
  /** VFX ops (doc 25 §3, ADR-0011) — lowered into a pre-grade DAG node so the cleaned plate flows
   *  through grade->composite->export like any other node. Not yet wired into the compiler/lower
   *  passes (follow-up); recorded here so it round-trips and is reproducible/cacheable once it is. */
  vfx?: VfxOp[];
}

export interface VfxOp {
  id: Id;
  kind: "remove_object";
  /** [startS, endS] range within the clip this op applies to. */
  atS: [number, number];
  region?: { x: number; y: number; w: number; h: number };
  maskRef?: string;
  prompt?: string;
  provider: "void";
}

export interface Clip {
  id: Id;
  /** id of a Source in EDD.sources. */
  src: Id;
  inS: number;
  outS: number;
  transform?: Transform;
}

/** doc 24 §5, ADR-0010: b-roll composited over the a-roll during a window on the main timeline —
 *  from a library provider (vector-broll/Pexels/Pixabay) or a generated asset, never scraped. */
export interface BrollTrack {
  id: Id;
  kind: "broll";
  clips: BrollClip[];
}

export interface BrollClip {
  id: Id;
  /** id of a Source in EDD.sources (typically origin: "provider" | "generated" — doc 24 §7). */
  src: Id;
  /** In/out within the b-roll source itself. */
  inS: number;
  outS: number;
  /** [startS, endS] on the MAIN timeline where this b-roll is composited over the a-roll. */
  atS: [number, number];
  /** 0 (invisible) .. 1 (fully opaque, a straight cutaway). Default 1. */
  opacity?: number;
}

export interface Transform {
  scale?: number;
  position?: { x: number; y: number };
  crop?: { x: number; y: number; w: number; h: number };
  speed?: number;
  /** Intent-level "breathe" punch-in; lowered to keyframes (PRD §12.4, §15.8). */
  punchIn?: PunchIn;
}

export interface PunchIn {
  from: number;
  to: number;
  /** easing name, e.g. "io" (in-out), "linear". */
  ease?: string;
}

export interface Transition {
  /** [fromClipId, toClipId]. */
  between: [Id, Id];
  /** e.g. "cut", "whip", "fade". */
  type: string;
  durationS?: number;
  ease?: string;
}

export interface Effect {
  type: "color" | "denoise" | "sharpen" | "vignette";
  spec: Record<string, unknown>;
}

export interface CaptionTrack {
  id: Id;
  kind: "captions";
  /** Reference to a caption style (STYLE.md token or plugin). */
  styleRef?: string;
  /** Google Fonts family name resolved via Font Studio (doc 24 §3), e.g. "Anton". */
  fontRef?: string;
  words: Word[];
}

export interface Word {
  t: string;
  startS: number;
  endS: number;
  /** Emphasis (e.g. key/legal terms): larger + accent on render. */
  emph?: boolean;
}

export interface GraphicsTrack {
  id: Id;
  kind: "graphics";
  items: GraphicItem[];
}

export interface GraphicItem {
  id: Id;
  /** Remotion component name (PRD §15.4). */
  component: string;
  props?: Record<string, unknown>;
  startS: number;
  endS: number;
}

export interface AudioTrack {
  id: Id;
  kind: "audio";
  voice?: Voice;
  music?: Music;
  sfx?: Sfx[];
}

export interface Voice {
  /** Ordered ffmpeg-style chain, e.g. ["highpass=80","afftdn:nr=12","deesser"]. */
  chain?: string[];
  loudness?: { targetLUFS: number; tpDb?: number };
}

export interface Music {
  src?: string | null;
  targetLUFS?: number;
  /** e.g. "sidechain". */
  duck?: string;
  providerId?: string;
  license?: string;
  attribution?: string;
}

export interface Sfx {
  cue: string;
  atS: number;
  providerId?: string;
  license?: string;
}

export interface ExportSpec {
  container: string;
  vcodec: string;
  acodec: string;
  w: number;
  h: number;
  fps: number;
  crf?: number;
  faststart?: boolean;
  preset?: string;
}

export interface Provenance {
  /** dotted path into the EDD, e.g. "timeline.tracks.aroll.effects[0]". */
  node: string;
  by: string;
  why: string;
}

/** A structured diagnostic from a compiler pass (PRD §12.8). */
export interface Diagnostic {
  code: string;
  severity: "error" | "warning";
  /** dotted/bracketed path to the offending node. */
  path: string;
  message: string;
  suggestion?: string;
}
