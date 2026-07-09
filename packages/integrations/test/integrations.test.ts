import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildKeyframeFfmpegArgs,
  parseShowinfoTimestamps,
  buildAnalysisPrompt,
  parseFootageAnalysisResponse,
  FootageAnalysisParseError,
  buildVoidInferenceArgs,
  isVoidAvailable,
  removeObject,
  VoidRequiresGpuError,
  VoidNotInstalledError,
} from "../src/index.ts";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ov-integrations-"));
}

test("buildKeyframeFfmpegArgs: scene-aware select + frame cap + output pattern", () => {
  const args = buildKeyframeFfmpegArgs("/in/clip.mp4", "/out/frames", { sceneThreshold: 0.3, maxFrames: 20 });
  assert.ok(args.includes("-i"));
  assert.equal(args[args.indexOf("-i") + 1], "/in/clip.mp4");
  const vf = args[args.indexOf("-vf") + 1]!;
  assert.match(vf, /gt\(scene,0\.3\)/);
  assert.match(vf, /showinfo/);
  assert.equal(args[args.indexOf("-frames:v") + 1], "20");
  assert.ok(args.at(-1)!.includes("frame-%04d.jpg"));
});

test("buildKeyframeFfmpegArgs: sensible defaults when opts omitted", () => {
  const args = buildKeyframeFfmpegArgs("/in/clip.mp4", "/out");
  assert.equal(args[args.indexOf("-frames:v") + 1], "40");
  assert.equal(args[args.indexOf("-q:v") + 1], "4");
});

test("parseShowinfoTimestamps extracts pts_time values in order", () => {
  const stderr = [
    "[Parsed_showinfo_1 @ 0x1] n:0 pts:0 pts_time:0.000000",
    "some unrelated ffmpeg log line",
    "[Parsed_showinfo_1 @ 0x1] n:1 pts:2400 pts_time:1.600000",
    "[Parsed_showinfo_1 @ 0x1] n:2 pts:5760 pts_time:3.840000",
  ].join("\n");
  const ts = parseShowinfoTimestamps(stderr);
  assert.deepEqual(ts, [0, 1.6, 3.84]);
});

test("parseShowinfoTimestamps returns [] when there's no showinfo output", () => {
  assert.deepEqual(parseShowinfoTimestamps("nothing relevant here"), []);
});

test("buildAnalysisPrompt references every keyframe path + timestamp and the schema", () => {
  const prompt = buildAnalysisPrompt({
    sourceId: "src_abc",
    keyframes: [
      { path: "/tmp/f/frame-0001.jpg", atS: 0 },
      { path: "/tmp/f/frame-0002.jpg", atS: 4.2 },
    ],
    transcript: "hello world",
  });
  assert.match(prompt, /src_abc/);
  assert.match(prompt, /frame-0001\.jpg/);
  assert.match(prompt, /frame-0002\.jpg/);
  assert.match(prompt, /4\.20s/);
  assert.match(prompt, /hello world/);
  assert.match(prompt, /"shots"/);
});

test("buildAnalysisPrompt notes a missing transcript rather than fabricating one", () => {
  const prompt = buildAnalysisPrompt({ sourceId: "s", keyframes: [] });
  assert.match(prompt, /No transcript available/);
});

test("parseFootageAnalysisResponse parses a well-formed JSON response, fills missing fields", () => {
  const raw = `Here is my analysis:\n${JSON.stringify({
    shots: [{ startS: 0, endS: 2, shotType: "wide", energy: 0.4, subjects: ["person"], usable: true }],
  })}\nHope that helps!`;
  const analysis = parseFootageAnalysisResponse(raw, "src_1", 5);
  assert.equal(analysis.sourceId, "src_1");
  assert.equal(analysis.frameCount, 5);
  assert.equal(analysis.shots.length, 1);
  assert.deepEqual(analysis.brollOpportunities, []);
});

test("parseFootageAnalysisResponse rejects prose with no JSON object", () => {
  assert.throws(() => parseFootageAnalysisResponse("sorry, I can't do that", "s", 0), FootageAnalysisParseError);
});

test("parseFootageAnalysisResponse rejects JSON missing shots[]", () => {
  assert.throws(() => parseFootageAnalysisResponse('{"foo":1}', "s", 0), FootageAnalysisParseError);
});

test("buildVoidInferenceArgs: full spec with region + mask + prompt", () => {
  const args = buildVoidInferenceArgs(
    { clipPath: "/in.mp4", atS: [1, 3], region: { x: 10, y: 20, w: 100, h: 200 }, maskPath: "/mask.png", prompt: "remove the sign" },
    "/out.mp4",
    "/weights/void",
  );
  assert.deepEqual(
    args,
    [
      "--weights", "/weights/void",
      "--input", "/in.mp4",
      "--output", "/out.mp4",
      "--start", "1",
      "--end", "3",
      "--region", "10,20,100,200",
      "--mask", "/mask.png",
      "--prompt", "remove the sign",
    ],
  );
});

test("buildVoidInferenceArgs: minimal spec omits optional flags", () => {
  const args = buildVoidInferenceArgs({ clipPath: "/in.mp4", atS: [0, 1] }, "/out.mp4", "/weights");
  assert.ok(!args.includes("--region"));
  assert.ok(!args.includes("--mask"));
  assert.ok(!args.includes("--prompt"));
});

test("isVoidAvailable is false with no weights directory present", () => {
  assert.equal(isVoidAvailable({ weightsDir: path.join(tmpDir(), "nonexistent") }), false);
});

test("removeObject throws VoidRequiresGpuError or VoidNotInstalledError honestly (never silently no-ops)", async () => {
  const dir = tmpDir();
  await assert.rejects(
    () => removeObject({ clipPath: "/in.mp4", atS: [0, 1] }, path.join(dir, "out.mp4"), { weightsDir: path.join(dir, "empty-weights") }),
    (e: Error) => e instanceof VoidRequiresGpuError || e instanceof VoidNotInstalledError,
  );
});
