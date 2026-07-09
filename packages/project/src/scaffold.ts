/**
 * OpenVideo — scaffold an initial EDD from a probed clip (PRD §11.2 PLAN/ASSEMBLE baseline).
 *
 * Produces a sensible default timeline: the whole clip as one a-roll clip, a tasteful SDR grade
 * (tonemap if the source looks HDR/HLG), an audio chain leveled to the platform target, and a
 * platform export preset. Agents refine this; it is the "auto timeline" a user gets for free.
 */

import type { EDD, Probe } from "@openvideo/edd";

export interface ScaffoldOptions {
  platform?: string;
  width?: number;
  height?: number;
  fps?: number;
}

export function scaffoldEdd(sourceId: string, probe: Probe, sourcePath: string, opts: ScaffoldOptions = {}): EDD {
  const width = opts.width ?? (probe.w > 0 ? probe.w : 1080);
  const height = opts.height ?? (probe.h > 0 ? probe.h : 1920);
  const fps = opts.fps ?? (probe.fps > 0 ? probe.fps : 30);
  const durationS = probe.durationS > 0 ? probe.durationS : 1;
  const platform = opts.platform ?? "instagram_reel";

  const hdr = (probe.color ?? "").toLowerCase();
  const isHdr = hdr.includes("hlg") || hdr.includes("bt2020") || hdr.includes("pq");
  const colorSpec = isHdr
    ? { tonemap: "hlg_to_bt709", wb: "neutralize", contrast: "s_curve_light", vibrance: 0.1, sharpen: 0.6, protectSkin: true }
    : { contrast: "s_curve_light", vibrance: 0.08, sharpen: 0.4 };

  return {
    schemaVersion: "1.0",
    id: `edd_${sourceId}`,
    project: { id: `prj_${sourceId}`, width, height, fps, colorSpace: "bt709", platform, styleRef: "STYLE.md" },
    sources: [{ id: sourceId, path: sourcePath, probe }],
    timeline: {
      durationS,
      tracks: [
        {
          id: "aroll",
          kind: "video",
          clips: [{ id: "c1", src: sourceId, inS: 0, outS: durationS }],
          effects: [{ type: "color", spec: colorSpec }],
        },
        {
          id: "audio",
          kind: "audio",
          voice: { chain: ["highpass=80", "afftdn=nr=10:nf=-25"], loudness: { targetLUFS: -14, tpDb: -1.5 } },
        },
      ],
    },
    export: { container: "mp4", vcodec: "h264_high", acodec: "aac", w: width, h: height, fps, crf: 18, faststart: true, preset: platform },
  };
}
