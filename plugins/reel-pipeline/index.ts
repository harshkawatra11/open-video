/**
 * OpenVideo — the flagship "reel-pipeline" plugin (doc 15 authoring example; PRD §2's flagship use
 * case). Plugins are plain folders (doc 15 "Distribution") — this one deliberately has NO dependency
 * on @openvideo/edd or any workspace package, so it stays shareable as a standalone file/git checkout,
 * exactly like a third-party author's plugin would be. It duck-types the EDD shape it needs instead.
 *
 * Capability: "edd:patch" — `applyTemplate(edd, params)` returns a new EDD with reel-pacing applied:
 * every video clip that doesn't already have a punch-in gets one (the PoC's F-series findings showed
 * static clips read as "dead" on short-form; a gentle punch-in is the cheapest fix), and the audio
 * track's loudness target is set if missing. This is the same shape of transform a real Director
 * session performs via edd_apply_patch — the plugin just packages a proven default as one call.
 */

export interface ReelPipelineParams {
  punchInAmplitude?: number;
  punchInEase?: string;
  targetLUFS?: number;
}

interface ClipLike {
  id: string;
  transform?: { scale?: number; punchIn?: { from: number; to: number; ease?: string } };
  [k: string]: unknown;
}

interface VideoTrackLike {
  kind: "video";
  clips: ClipLike[];
  [k: string]: unknown;
}

interface AudioTrackLike {
  kind: "audio";
  voice?: { loudness?: { targetLUFS: number; tpDb?: number } };
  [k: string]: unknown;
}

type TrackLike = VideoTrackLike | AudioTrackLike | { kind: string; [k: string]: unknown };

interface EddLike {
  timeline: { tracks: TrackLike[] };
  [k: string]: unknown;
}

const DEFAULTS: Required<ReelPipelineParams> = {
  punchInAmplitude: 0.03,
  punchInEase: "io",
  targetLUFS: -14,
};

/** Pure — never mutates the input EDD (structuredClone), so it's safe to call speculatively and
 *  compare before/after in a plan-mode UI. */
export function applyTemplate<T extends EddLike>(edd: T, params: ReelPipelineParams = {}): T {
  const p = { ...DEFAULTS, ...params };
  const next = structuredClone(edd);

  for (const track of next.timeline.tracks) {
    if (track.kind === "video") {
      const vt = track as VideoTrackLike;
      for (const clip of vt.clips) {
        if (!clip.transform?.punchIn) {
          clip.transform = {
            ...clip.transform,
            punchIn: { from: clip.transform?.scale ?? 1, to: (clip.transform?.scale ?? 1) + p.punchInAmplitude, ease: p.punchInEase },
          };
        }
      }
    }
    if (track.kind === "audio") {
      const at = track as AudioTrackLike;
      if (!at.voice?.loudness) {
        at.voice = { ...at.voice, loudness: { targetLUFS: p.targetLUFS } };
      }
    }
  }

  return next;
}
