import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest, isValidManifest, discoverPlugins, loadPlugin } from "../src/index.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const REAL_PLUGINS_DIR = path.join(REPO_ROOT, "plugins");

test("validateManifest accepts a well-formed manifest", () => {
  const diags = validateManifest({
    name: "x",
    version: "1.0.0",
    type: "template",
    entry: "index.ts",
    capabilities: ["edd:patch"],
    permissions: [],
    license: "MIT",
  });
  assert.deepEqual(diags, []);
});

test("validateManifest flags every missing/invalid required field", () => {
  const diags = validateManifest({ type: "not-a-real-type" });
  const codes = diags.map((d) => d.code).sort();
  assert.deepEqual(codes, ["PLUGIN001", "PLUGIN002", "PLUGIN003", "PLUGIN004", "PLUGIN007"]);
});

test("isValidManifest is a type guard matching validateManifest", () => {
  assert.equal(isValidManifest({ name: "x", version: "1", type: "skill", entry: "i.ts", capabilities: [], permissions: [], license: "MIT" }), true);
  assert.equal(isValidManifest({}), false);
});

test("discoverPlugins finds the real flagship reel-pipeline plugin under plugins/", () => {
  const { plugins, errors } = discoverPlugins(REAL_PLUGINS_DIR);
  assert.deepEqual(errors, []);
  const reel = plugins.find((p) => p.manifest.name === "reel-pipeline");
  assert.ok(reel, "expected to discover the reel-pipeline plugin");
  assert.equal(reel!.manifest.type, "template");
  assert.ok(reel!.manifest.capabilities.includes("edd:patch"));
});

test("discoverPlugins reports (not throws) on a directory with a broken manifest", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ov-plugins-"));
  fs.mkdirSync(path.join(dir, "broken"));
  fs.writeFileSync(path.join(dir, "broken", "openvideo.json"), "{ not valid json");
  fs.mkdirSync(path.join(dir, "missing-manifest"));

  const { plugins, errors } = discoverPlugins(dir);
  assert.equal(plugins.length, 0);
  assert.equal(errors.length, 2);
  assert.ok(errors.some((e) => e.errors[0]!.includes("invalid JSON")));
  assert.ok(errors.some((e) => e.errors[0]!.includes("no openvideo.json")));
});

test("discoverPlugins returns empty (not throws) for a nonexistent directory", () => {
  const result = discoverPlugins(path.join(os.tmpdir(), "definitely-does-not-exist-xyz"));
  assert.deepEqual(result, { plugins: [], errors: [] });
});

test("loadPlugin REALLY dynamic-imports the reel-pipeline plugin and its transform works on a real EDD shape", async () => {
  const { plugins } = discoverPlugins(REAL_PLUGINS_DIR);
  const reel = plugins.find((p) => p.manifest.name === "reel-pipeline")!;
  const mod = await loadPlugin(reel);
  assert.equal(typeof mod.applyTemplate, "function");

  const edd = {
    timeline: {
      tracks: [
        { kind: "video", clips: [{ id: "c1" }, { id: "c2", transform: { punchIn: { from: 1, to: 1.05 } } }] },
        { kind: "audio" },
      ],
    },
  };
  const patched = (mod.applyTemplate as (e: unknown, p?: unknown) => any)(edd, reel.manifest.params);

  const videoTrack = patched.timeline.tracks[0];
  assert.deepEqual(videoTrack.clips[0].transform.punchIn, { from: 1, to: 1.03, ease: "io" });
  // clip that already had a punch-in is left untouched
  assert.deepEqual(videoTrack.clips[1].transform.punchIn, { from: 1, to: 1.05 });

  const audioTrack = patched.timeline.tracks[1];
  assert.equal(audioTrack.voice.loudness.targetLUFS, -14);

  // original input is never mutated
  assert.equal((edd.timeline.tracks[0] as any).clips[0].transform, undefined);
});
