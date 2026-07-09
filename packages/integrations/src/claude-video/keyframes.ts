/**
 * OpenVideo — claude-video keyframe extraction (doc 25 §2). Reuses our own ffmpeg, scene-aware and
 * adaptive: ffmpeg's `select` filter picks frames where the scene-change score exceeds a threshold
 * (plus the very first frame), capped at `maxFrames` so vision cost stays bounded (PRD §22.8). We ask
 * for `showinfo` in the same filter chain so ffmpeg logs each kept frame's real presentation
 * timestamp to stderr — parsed back out so every extracted JPG is paired with its true time in the
 * source, not an assumed fixed interval.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveBin, FFMPEG_BIN } from "@openvideo/render";

export interface KeyframeOptions {
  /** Scene-change sensitivity in [0,1]; higher = fewer, more decisive cuts kept. Default 0.28. */
  sceneThreshold?: number;
  /** Hard cap on extracted frames (cost control). Default 40. */
  maxFrames?: number;
  /** JPEG quality 2 (best) .. 31 (worst), ffmpeg -q:v convention. Default 4. */
  quality?: number;
}

export interface Keyframe {
  path: string;
  atS: number;
}

/** Pure: builds the ffmpeg argument vector for scene-aware keyframe extraction (offline-testable). */
export function buildKeyframeFfmpegArgs(videoPath: string, outDir: string, opts: KeyframeOptions = {}): string[] {
  const threshold = opts.sceneThreshold ?? 0.28;
  const maxFrames = opts.maxFrames ?? 40;
  const quality = opts.quality ?? 4;
  const filter = `select='gt(scene,${threshold})+eq(n\\,0)',showinfo`;
  return [
    "-y",
    "-i",
    videoPath,
    "-vf",
    filter,
    "-vsync",
    "vfr",
    "-frames:v",
    String(maxFrames),
    "-q:v",
    String(quality),
    path.join(outDir, "frame-%04d.jpg"),
  ];
}

/** Pure: parses ffmpeg `showinfo` stderr lines for each kept frame's presentation timestamp. */
export function parseShowinfoTimestamps(stderr: string): number[] {
  const out: number[] = [];
  const re = /pts_time:([0-9.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stderr))) out.push(Number(m[1]));
  return out;
}

/** Runs real ffmpeg to extract scene-aware keyframes, pairing each output file with its real
 *  timestamp. Integration-level (spawns the real binary) — not exercised in offline unit tests. */
export function extractKeyframes(videoPath: string, outDir: string, opts: KeyframeOptions = {}): Promise<Keyframe[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const args = buildKeyframeFfmpegArgs(videoPath, outDir, opts);
  return new Promise((resolve, reject) => {
    const child = spawn(resolveBin(FFMPEG_BIN), args, { windowsHide: true });
    let stderr = "";
    child.stderr?.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg (keyframes) exited ${code}: ${stderr.slice(-800)}`));
      const timestamps = parseShowinfoTimestamps(stderr);
      const files = fs
        .readdirSync(outDir)
        .filter((f) => /^frame-\d+\.jpg$/.test(f))
        .sort();
      resolve(files.map((f, i) => ({ path: path.join(outDir, f), atS: timestamps[i] ?? 0 })));
    });
  });
}
