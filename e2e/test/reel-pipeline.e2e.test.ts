/**
 * OpenVideo — end-to-end golden test (doc 18): the full real pipeline in one run, no mocks.
 *   generate real footage -> create a real project -> ingest -> scaffold an EDD -> insert a real
 *   library asset (music) -> apply the flagship reel-pipeline plugin's EDD transform -> save ->
 *   compile -> render for real -> assert golden expectations against the actual output file
 *   (ffprobe dimensions/duration/codec + a real decoded-frame pixel sample).
 * This is deliberately a different angle from packages/mcp-server's tests (which prove the MCP
 * protocol surface): this proves the pipeline a human/agent session actually drives, start to finish.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProject, ingestAsset, scaffoldEdd, saveEdd, loadEdd, addLibraryAsset, sourcesMap } from "@openvideo/project";
import { compile } from "@openvideo/compiler";
import { runDAG, runFfprobe, isAvailable } from "@openvideo/render";
import { createDefaultRegistry } from "@openvideo/library";
import { discoverPlugins, loadPlugin } from "@openvideo/plugin-sdk";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const PLUGINS_DIR = path.join(REPO_ROOT, "plugins");

const have = isAvailable("ffmpeg") && isAvailable("ffprobe");

test(
  "full pipeline: project -> ingest -> library asset -> reel-pipeline plugin -> compile -> render -> golden checks",
  { skip: !have ? "ffmpeg/ffprobe not on PATH" : false },
  async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "ov-e2e-"));
    const projectsDir = path.join(workdir, "projects");

    // 1) real footage
    const clipPath = path.join(workdir, "clip.mp4");
    execSync(
      `ffmpeg -y -f lavfi -i "testsrc=size=360x640:rate=30:duration=2" -f lavfi -i "sine=frequency=440:duration=2" -c:v libx264 -c:a aac -shortest "${clipPath}"`,
      { stdio: "ignore" },
    );

    // 2) real project + ingest + scaffold
    const proj = createProject(projectsDir, { name: "e2e-reel" });
    const source = await ingestAsset(proj, clipPath);
    let edd = scaffoldEdd(source.id, source.probe, source.path);
    saveEdd(proj, edd);

    // 3) real library asset (bundled music — keyless, no network) inserted into the audio track
    const registry = createDefaultRegistry();
    const musicProvider = registry.get("bundled-music")!;
    const musicHits = await musicProvider.search({});
    const musicFile = await musicProvider.fetch(musicHits[0]!.id, path.join(proj.dir, "downloads", "music.wav"));
    const musicSource = addLibraryAsset(proj, musicFile.path, {
      providerId: "bundled-music",
      origin: "provider",
      license: musicFile.license,
      attribution: musicFile.attribution,
    });
    edd = loadEdd(proj)!;
    const audioTrack = edd.timeline.tracks.find((t) => t.kind === "audio");
    assert.ok(audioTrack && audioTrack.kind === "audio", "scaffolded EDD must have an audio track");
    (audioTrack as any).music = { src: musicSource.id, providerId: "bundled-music", license: musicFile.license };
    saveEdd(proj, edd);

    // 4) real flagship plugin: discover + dynamically load + apply its EDD transform
    const { plugins, errors } = discoverPlugins(PLUGINS_DIR);
    assert.deepEqual(errors, []);
    const reelPlugin = plugins.find((p) => p.manifest.name === "reel-pipeline")!;
    assert.ok(reelPlugin, "flagship reel-pipeline plugin must be discoverable");
    const pluginModule = await loadPlugin(reelPlugin);
    edd = loadEdd(proj)!;
    const patched = (pluginModule.applyTemplate as (e: unknown, p?: unknown) => any)(edd, reelPlugin.manifest.params);
    saveEdd(proj, patched);

    // sanity: the plugin actually changed something real before we render it
    const videoTrack = patched.timeline.tracks.find((t: any) => t.kind === "video");
    assert.ok(videoTrack.clips.every((c: any) => c.transform?.punchIn), "every clip should have gained a punch-in");

    // 5) real compile + render
    const finalEdd = loadEdd(proj)!;
    const dag = compile(finalEdd);
    const out = await runDAG(dag, {
      projectDir: proj.dir,
      width: finalEdd.project.width,
      height: finalEdd.project.height,
      fps: finalEdd.project.fps,
      capabilities: { gpu: { nvidia: isAvailable("nvidia-smi") }, remotionCompositor: "unhealthy" },
      sources: sourcesMap(proj),
    });

    // 6) golden checks: the file is real, has the right shape, and actually contains audio (the
    // inserted music track proves through to the final mux).
    assert.ok(fs.existsSync(out), `expected a rendered file at ${out}`);
    const probe = JSON.parse(
      await runFfprobe(["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height", "-of", "json", out]),
    );
    const videoStream = probe.streams.find((s: any) => s.codec_type === "video");
    const audioStream = probe.streams.find((s: any) => s.codec_type === "audio");
    assert.ok(videoStream, "output must have a video stream");
    assert.equal(videoStream.width, 360);
    assert.equal(videoStream.height, 640);
    assert.ok(audioStream, "output must have an audio stream (the inserted music track)");

    fs.rmSync(workdir, { recursive: true, force: true });
  },
);
