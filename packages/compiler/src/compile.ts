/**
 * OpenVideo — codegen: EDD -> IR -> execution DAG (PRD §12.6).
 *
 * Builds a content-addressed DAG from an EDD. Uses the EDD for structure/effects/source hashes and
 * the lowered IR for frame-exact clip/caption/graphics/audio data. Cache keys are deterministic, so
 * re-compiling an unchanged EDD yields identical keys (cache hits), and a localized change re-keys
 * only the affected subtree (incremental rendering — PRD §14.5).
 */

import { createHash } from "node:crypto";
import { lowerEDD } from "@openvideo/edd";
import type { EDD, ClipOp, CaptionOp, GraphicOp, AudioOp, BrollOp } from "@openvideo/edd";
import type { DAGNode, ExecutionDAG, Resource } from "./dag.ts";

export interface CompileOptions {
  /** Pinned tool versions folded into every cache key (PRD §14.4). */
  toolVersions?: Record<string, string>;
}

const OUTPUT_EXT: Record<string, string> = {
  cut: "mp4",
  tonemap_grade: "mp4",
  remotion_render: "mov",
  level_audio: "wav",
  ffmpeg_compose: "mp4",
  encode: "mp4",
  vfx_remove_object: "mp4",
};

/** Deterministic JSON: object keys sorted recursively. */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = sortDeep((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

interface NodeSpec {
  id: string;
  op: string;
  inputs: string[];
  params: Record<string, unknown>;
  resource: Resource;
}

/** Compile an EDD into a content-addressed, topologically-ordered execution DAG. */
export function compile(edd: EDD, opts: CompileOptions = {}): ExecutionDAG {
  const ir = lowerEDD(edd); // validates + frame-exact lowering (throws on invalid EDD)
  const toolVersions = opts.toolVersions ?? {};

  const sourceHash = new Map<string, string>();
  for (const s of edd.sources) sourceHash.set(s.id, s.hash ?? `path:${s.path}`);

  const specs: NodeSpec[] = [];
  const gradeIds: string[] = [];

  // --- video tracks: cut (source -> trimmed) then tonemap/grade ---
  for (const track of ir.tracks) {
    if (track.kind !== "video") continue;
    const clipOps = track.ops.filter((o): o is ClipOp => o.op === "clip");
    const srcIds = [...new Set(clipOps.map((c) => c.src))];
    const eddTrack = edd.timeline.tracks.find((t) => t.id === track.id);
    const effects = eddTrack && eddTrack.kind === "video" ? (eddTrack.effects ?? []) : [];

    const cutId = `cut:${track.id}`;
    specs.push({
      id: cutId,
      op: "cut",
      inputs: srcIds,
      params: {
        clips: clipOps.map((c) => ({
          clipId: c.clipId,
          src: c.src,
          inFrame: c.inFrame,
          outFrame: c.outFrame,
          scale: c.scale,
        })),
      },
      resource: "cpu",
    });

    // --- vfx (doc 25 §3, ADR-0011): each remove_object op chains onto the previous stage, so the
    // cleaned plate flows into grade like any other pre-grade transform. Zero ops -> untouched
    // cut->grade edge, same DAG shape as before this feature existed.
    let preGradeId = cutId;
    const vfxOps = eddTrack && eddTrack.kind === "video" ? (eddTrack.vfx ?? []) : [];
    vfxOps.forEach((vfx, i) => {
      const vfxId = `vfx:${track.id}:${vfx.id}`;
      specs.push({
        id: vfxId,
        op: "vfx_remove_object",
        inputs: [preGradeId],
        params: { atS: vfx.atS, region: vfx.region, maskRef: vfx.maskRef, prompt: vfx.prompt, provider: vfx.provider, seq: i },
        resource: "gpu",
      });
      preGradeId = vfxId;
    });

    const gradeId = `grade:${track.id}`;
    specs.push({
      id: gradeId,
      op: "tonemap_grade",
      inputs: [preGradeId],
      params: { effects },
      resource: "cpu",
    });
    gradeIds.push(gradeId);
  }

  // --- overlay: captions + graphics as one transparent layer (Remotion) ---
  const captionOps: CaptionOp[] = [];
  const graphicOps: GraphicOp[] = [];
  for (const track of ir.tracks) {
    if (track.kind === "captions") captionOps.push(...(track.ops as CaptionOp[]));
    if (track.kind === "graphics") graphicOps.push(...(track.ops as GraphicOp[]));
  }
  const hasOverlay = captionOps.length > 0 || graphicOps.length > 0;
  if (hasOverlay) {
    specs.push({
      id: "overlay",
      op: "remotion_render",
      inputs: [],
      params: {
        width: ir.project.width,
        height: ir.project.height,
        fps: ir.fps,
        durationFrames: ir.durationFrames,
        captions: captionOps,
        graphics: graphicOps,
      },
      resource: "chrome",
    });
  }

  // --- b-roll: each clip gets its own cut node, composited over the a-roll during its placement
  // window (doc 24 §5). Reuses the "cut" op (same shape as a-roll's) since trimming a source region
  // is identical work regardless of which track it came from.
  const brollLayerIds: string[] = [];
  const brollLayers: Array<{ startFrame: number; endFrame: number; opacity: number }> = [];
  for (const track of ir.tracks) {
    if (track.kind !== "broll") continue;
    for (const op of track.ops as BrollOp[]) {
      const cutId = `broll_cut:${op.clipId}`;
      specs.push({
        id: cutId,
        op: "cut",
        inputs: [op.src],
        params: {
          clips: [
            {
              clipId: op.clipId,
              src: op.src,
              inFrame: op.inFrame,
              outFrame: op.outFrame,
              scale: [{ frame: 0, value: 1, ease: "linear" }],
            },
          ],
        },
        resource: "cpu",
      });
      brollLayerIds.push(cutId);
      brollLayers.push({ startFrame: op.startFrame, endFrame: op.endFrame, opacity: op.opacity });
    }
  }

  // --- audio mix ---
  let audioId: string | undefined;
  const audioTrack = ir.tracks.find((t) => t.kind === "audio");
  if (audioTrack) {
    const a = audioTrack.ops[0] as AudioOp | undefined;
    const srcIds = [...sourceHash.keys()]; // audio comes from the source media
    audioId = "audio";
    specs.push({
      id: audioId,
      op: "level_audio",
      inputs: srcIds,
      params: a
        ? { voiceChain: a.voiceChain, targetLUFS: a.targetLUFS, tpDb: a.tpDb, music: a.music, sfx: a.sfx }
        : {},
      resource: "cpu",
    });
  }

  // --- composite: graded a-roll(s) + b-roll layers (timed overlay) + overlay (captions/graphics) ---
  const compositeInputs = [...gradeIds, ...brollLayerIds, ...(hasOverlay ? ["overlay"] : [])];
  specs.push({
    id: "composite",
    op: "ffmpeg_compose",
    inputs: compositeInputs,
    params: { width: ir.project.width, height: ir.project.height, fps: ir.fps, brollLayers, hasOverlay },
    resource: "gpu",
  });

  // --- export: composite + audio -> final encode (terminal) ---
  specs.push({
    id: "export",
    op: "encode",
    inputs: ["composite", ...(audioId ? [audioId] : [])],
    params: { ...ir.exportSpec },
    resource: "gpu",
  });

  // Topologically order, then compute content-addressed keys in that order.
  const ordered = topoSort(specs);
  const keyById = new Map<string, string>();
  const nodes: DAGNode[] = ordered.map((spec) => {
    const inputKeys = spec.inputs.map((inId) => keyById.get(inId) ?? sourceHash.get(inId) ?? `?:${inId}`);
    const key = sha256(
      [spec.op, stableStringify(spec.params), inputKeys.join(","), stableStringify(toolVersions)].join("|"),
    );
    keyById.set(spec.id, key);
    const ext = OUTPUT_EXT[spec.op] ?? "bin";
    return { ...spec, key, output: `cache/blobs/${key}.${ext}` };
  });

  return { nodes, rootId: "export" };
}

/** Kahn topological sort over node specs; edges exist only between node ids (sources are leaves). */
function topoSort(specs: NodeSpec[]): NodeSpec[] {
  const byId = new Map(specs.map((s) => [s.id, s]));
  const indeg = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const s of specs) indeg.set(s.id, 0);
  for (const s of specs) {
    for (const inId of s.inputs) {
      if (!byId.has(inId)) continue; // a source leaf, not a node
      indeg.set(s.id, (indeg.get(s.id) ?? 0) + 1);
      dependents.set(inId, [...(dependents.get(inId) ?? []), s.id]);
    }
  }
  const queue = specs.filter((s) => (indeg.get(s.id) ?? 0) === 0).map((s) => s.id);
  const out: NodeSpec[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    out.push(byId.get(id)!);
    for (const dep of dependents.get(id) ?? []) {
      indeg.set(dep, (indeg.get(dep) ?? 0) - 1);
      if ((indeg.get(dep) ?? 0) === 0) queue.push(dep);
    }
  }
  if (out.length !== specs.length) {
    throw new Error("execution graph is not a DAG (cycle detected)");
  }
  return out;
}
