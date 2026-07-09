/**
 * Integration test: compile a minimal EDD and render it to a real MP4 with the installed ffmpeg,
 * then ffprobe-verify the output. Skips automatically if ffmpeg/ffprobe are not on PATH.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { compile } from "@openvideo/compiler";
import type { EDD } from "@openvideo/edd";
import { runDAG, runFfmpeg, runFfprobe, isAvailable } from "../src/index.ts";

const have = isAvailable("ffmpeg") && isAvailable("ffprobe");

test("renders a minimal EDD to a real, valid MP4", { skip: !have ? "ffmpeg/ffprobe not on PATH" : false }, async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "openvideo-render-"));
  try {
    // 1) Generate a tiny test source (no external media needed).
    const source = path.join(dir, "source.mp4");
    await runFfmpeg([
      "-y",
      "-f", "lavfi", "-i", "testsrc=size=360x640:rate=30:duration=1",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
      "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", source,
    ]);
    assert.ok(existsSync(source), "test source was created");

    // 2) A minimal EDD: one clip, a light SDR grade, an audio target. No captions/graphics.
    const edd: EDD = {
      schemaVersion: "1.0",
      id: "edd_int",
      project: { id: "prj_int", width: 360, height: 640, fps: 30, colorSpace: "bt709", platform: "instagram_reel" },
      sources: [{ id: "src_1", path: source }],
      timeline: {
        durationS: 1,
        tracks: [
          { id: "aroll", kind: "video", clips: [{ id: "c1", src: "src_1", inS: 0, outS: 1 }], effects: [{ type: "color", spec: { contrast: "s_curve_light", sharpen: 0.4 } }] },
          { id: "audio", kind: "audio", voice: { chain: [], loudness: { targetLUFS: -14, tpDb: -1.5 } } },
        ],
      },
      export: { container: "mp4", vcodec: "h264_high", acodec: "aac", w: 360, h: 640, fps: 30, crf: 20, faststart: true },
    };

    // 3) Compile -> DAG, then run it for real.
    const dag = compile(edd);
    const events: string[] = [];
    const out = await runDAG(dag, {
      projectDir: dir,
      width: 360,
      height: 640,
      fps: 30,
      capabilities: { gpu: { nvidia: false }, remotionCompositor: "unhealthy" },
      sources: { src_1: source },
      onEvent: (e) => events.push(`${e.type}:${"id" in e ? e.id : ""}`),
    });

    // 4) Verify the deliverable exists and has the right dimensions.
    assert.ok(existsSync(out), `export exists at ${out}`);
    const probe = JSON.parse(
      await runFfprobe(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,codec_name", "-of", "json", out]),
    );
    const v = probe.streams[0];
    assert.equal(v.width, 360);
    assert.equal(v.height, 640);
    assert.ok(events.some((e) => e.startsWith("node-done:export")), "export node ran");

    // 5) Re-running hits the content-addressed cache for every node.
    const events2: string[] = [];
    await runDAG(dag, {
      projectDir: dir,
      width: 360,
      height: 640,
      fps: 30,
      capabilities: { gpu: { nvidia: false }, remotionCompositor: "unhealthy" },
      sources: { src_1: source },
      onEvent: (e) => events2.push(e.type),
    });
    assert.ok(events2.every((t) => t === "node-cached"), "second run is fully cached");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test(
  "a vfx_remove_object node fails honestly when no voidExecutor is configured (never silently skips the effect)",
  { skip: !have ? "ffmpeg/ffprobe not on PATH" : false },
  async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "openvideo-render-vfx-"));
    try {
      const source = path.join(dir, "source.mp4");
      await runFfmpeg([
        "-y",
        "-f", "lavfi", "-i", "testsrc=size=360x640:rate=30:duration=1",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
        "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", source,
      ]);

      const edd: EDD = {
        schemaVersion: "1.0",
        id: "edd_vfx_int",
        project: { id: "prj_vfx_int", width: 360, height: 640, fps: 30, colorSpace: "bt709", platform: "instagram_reel" },
        sources: [{ id: "src_1", path: source }],
        timeline: {
          durationS: 1,
          tracks: [
            {
              id: "aroll",
              kind: "video",
              clips: [{ id: "c1", src: "src_1", inS: 0, outS: 1 }],
              vfx: [{ id: "v1", kind: "remove_object", atS: [0, 1], provider: "void", prompt: "remove the sign" }],
            } as any,
            { id: "audio", kind: "audio", voice: { chain: [], loudness: { targetLUFS: -14, tpDb: -1.5 } } },
          ],
        },
        export: { container: "mp4", vcodec: "h264_high", acodec: "aac", w: 360, h: 640, fps: 30 },
      };

      const dag = compile(edd);
      await assert.rejects(
        () =>
          runDAG(dag, {
            projectDir: dir,
            width: 360,
            height: 640,
            fps: 30,
            capabilities: { gpu: { nvidia: false }, remotionCompositor: "unhealthy" },
            sources: { src_1: source },
          }),
        /voidExecutor|VOID/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
