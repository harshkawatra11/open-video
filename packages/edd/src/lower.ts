/**
 * OpenVideo — Lowering: EDD (Video AST) -> IR (PRD §12.4).
 *
 * Normalizes the intent-level EDD into a concrete, frame-exact IR: resolves time bases to project
 * fps, expands intent-level directives (e.g. the "breathe" punch-in) into explicit keyframes, and
 * carries through resolved audio/graphics ops. Style-token resolution (STYLE.md) is stubbed here
 * (returns values as-is) and will be implemented when packages/style lands.
 *
 * Throws if the EDD has error-severity diagnostics — callers should validate first (PRD §12.5).
 */

import { validateEDD } from "./validate.ts";
import type { EDD } from "./types.ts";
import type { IR, IRTrack, IROp, ClipOp, CaptionOp, GraphicOp, AudioOp, BrollOp, Keyframe } from "./ir.ts";

export class LoweringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoweringError";
  }
}

const toFrames = (seconds: number, fps: number): number => Math.round(seconds * fps);

export function lowerEDD(edd: EDD): IR {
  const errors = validateEDD(edd).filter((x) => x.severity === "error");
  if (errors.length > 0) {
    throw new LoweringError(
      `cannot lower an invalid EDD (${errors.length} error(s)): ` +
        errors.map((e) => `${e.code}@${e.path}: ${e.message}`).join("; "),
    );
  }

  const fps = edd.project.fps;
  const tracks: IRTrack[] = edd.timeline.tracks.map((t): IRTrack => {
    switch (t.kind) {
      case "video":
        return {
          id: t.id,
          kind: "video",
          ops: t.clips.map((c): IROp => {
            const inFrame = toFrames(c.inS, fps);
            const outFrame = toFrames(c.outS, fps);
            const op: ClipOp = {
              op: "clip",
              clipId: c.id,
              src: c.src,
              inFrame,
              outFrame,
              scale: expandScale(c.transform?.scale, c.transform?.punchIn, outFrame - inFrame),
            };
            return op;
          }),
        };
      case "captions":
        return {
          id: t.id,
          kind: "captions",
          ops: t.words.map((w): IROp => {
            const op: CaptionOp = {
              op: "caption",
              text: w.t,
              startFrame: toFrames(w.startS, fps),
              endFrame: toFrames(w.endS, fps),
              emph: w.emph === true,
            };
            return op;
          }),
        };
      case "graphics":
        return {
          id: t.id,
          kind: "graphics",
          ops: t.items.map((g): IROp => {
            const op: GraphicOp = {
              op: "graphic",
              id: g.id,
              component: g.component,
              props: g.props ?? {},
              startFrame: toFrames(g.startS, fps),
              endFrame: toFrames(g.endS, fps),
            };
            return op;
          }),
        };
      case "audio": {
        const op: AudioOp = {
          op: "audio",
          voiceChain: t.voice?.chain ?? [],
          targetLUFS: t.voice?.loudness?.targetLUFS ?? null,
          tpDb: t.voice?.loudness?.tpDb ?? null,
          music: {
            src: t.music?.src ?? null,
            targetLUFS: t.music?.targetLUFS ?? null,
            duck: t.music?.duck ?? null,
          },
          sfx: (t.sfx ?? []).map((s) => ({ cue: s.cue, atFrame: toFrames(s.atS, fps) })),
        };
        return { id: t.id, kind: "audio", ops: [op] };
      }
      case "broll":
        return {
          id: t.id,
          kind: "broll",
          ops: t.clips.map((c): IROp => {
            const op: BrollOp = {
              op: "broll",
              clipId: c.id,
              src: c.src,
              inFrame: toFrames(c.inS, fps),
              outFrame: toFrames(c.outS, fps),
              startFrame: toFrames(c.atS[0], fps),
              endFrame: toFrames(c.atS[1], fps),
              opacity: c.opacity ?? 1,
            };
            return op;
          }),
        };
    }
  });

  return {
    schemaVersion: edd.schemaVersion,
    project: edd.project,
    fps,
    durationFrames: toFrames(edd.timeline.durationS, fps),
    tracks,
    exportSpec: edd.export,
  };
}

/**
 * Expand an intent-level scale + optional punch-in into an explicit keyframe curve over the clip's
 * frame span. Consecutive segments authored by the agents are expected to meet at the same scale so
 * there is no pop (PRD §15.8); here we just emit the two keyframes the punch-in describes.
 */
function expandScale(
  baseScale: number | undefined,
  punchIn: { from: number; to: number; ease?: string } | undefined,
  spanFrames: number,
): Keyframe[] {
  if (punchIn) {
    const ease = punchIn.ease ?? "io";
    return [
      { frame: 0, value: punchIn.from, ease },
      { frame: Math.max(1, spanFrames), value: punchIn.to, ease },
    ];
  }
  return [{ frame: 0, value: baseScale ?? 1, ease: "linear" }];
}
