/**
 * Integration: create a project, ingest a real clip, scaffold + persist the EDD, and render it.
 * Skips if ffmpeg/ffprobe are not on PATH.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { compile } from "@openvideo/compiler";
import { runFfmpeg, runFfprobe, runDAG, isAvailable } from "@openvideo/render";
import { createProject, ingestAsset, scaffoldEdd, saveEdd, loadEdd, sourcesMap, readManifest } from "../src/index.ts";

const have = isAvailable("ffmpeg") && isAvailable("ffprobe");

test("project flow: create → ingest → scaffold → persist → render", { skip: !have ? "ffmpeg/ffprobe not on PATH" : false }, async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openvideo-proj-"));
  try {
    // a real source clip to ingest
    const raw = path.join(root, "raw.mp4");
    await runFfmpeg([
      "-y",
      "-f", "lavfi", "-i", "testsrc=size=480x854:rate=30:duration=1",
      "-f", "lavfi", "-i", "sine=frequency=300:duration=1",
      "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", raw,
    ]);

    const proj = createProject(root, { name: "test" });
    assert.ok(existsSync(path.join(proj.dir, "project.json")));
    assert.ok(existsSync(path.join(proj.dir, "STYLE.md")));

    const source = await ingestAsset(proj, raw);
    assert.ok(source.id.startsWith("src_"));
    assert.equal(readManifest(proj.dir).length, 1);
    assert.ok(existsSync(path.join(proj.dir, source.path)), "asset copied into project");
    assert.equal(source.probe.w, 480);

    const edd = scaffoldEdd(source.id, source.probe, source.path);
    saveEdd(proj, edd);
    assert.deepEqual(loadEdd(proj), edd, "EDD round-trips through disk");
    assert.ok(readdirSync(path.join(proj.dir, "versions")).length >= 1, "a version snapshot was written");

    const dag = compile(edd);
    const out = await runDAG(dag, {
      projectDir: proj.dir,
      width: edd.project.width,
      height: edd.project.height,
      fps: edd.project.fps,
      capabilities: { gpu: { nvidia: false }, remotionCompositor: "unhealthy" },
      sources: sourcesMap(proj),
      onEvent: () => {},
    });

    assert.ok(existsSync(out), "rendered the real ingested clip");
    const probe = JSON.parse(await runFfprobe(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", out]));
    assert.equal(probe.streams[0].width, 480);
    assert.equal(probe.streams[0].height, 854);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
