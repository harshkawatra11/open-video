/** OpenVideo — media probing via ffprobe (PRD §11.2 INGEST). */

import { runFfprobe } from "@openvideo/render";
import type { Probe } from "@openvideo/edd";

function fps(rate: string | undefined): number {
  if (!rate) return 30;
  const [n, d] = rate.split("/").map(Number);
  return d ? Math.round((n! / d) * 1000) / 1000 : (n ?? 30);
}

/** Probe a media file for the metadata the EDD/compiler need. */
export async function probeMedia(file: string): Promise<Probe> {
  const out = await runFfprobe([
    "-v", "error",
    "-show_entries", "stream=width,height,r_frame_rate,codec_name,codec_type",
    "-show_entries", "format=duration",
    "-of", "json",
    file,
  ]);
  const j = JSON.parse(out) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number; r_frame_rate?: string; codec_name?: string }>;
    format?: { duration?: string };
  };
  const streams = j.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");
  return {
    durationS: Number(j.format?.duration ?? 0),
    w: v?.width ?? 0,
    h: v?.height ?? 0,
    fps: fps(v?.r_frame_rate),
    ...(v?.codec_name ? { vcodec: v.codec_name } : {}),
    ...(a?.codec_name ? { acodec: a.codec_name } : {}),
  };
}
