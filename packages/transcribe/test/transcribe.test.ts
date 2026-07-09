import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  buildTranscribeArgs,
  toEddWords,
  resolvePythonBin,
  transcribe,
  FasterWhisperNotInstalledError,
} from "../src/index.ts";

test("buildTranscribeArgs points at the bundled script and passes through input/output/model/device", () => {
  const args = buildTranscribeArgs("/in/clip.mp4", "/out/words.json", { model: "small", device: "cuda" });
  assert.ok(args[0]!.endsWith(path.join("scripts", "transcribe.py")));
  assert.equal(args[1], "/in/clip.mp4");
  assert.equal(args[args.indexOf("--output") + 1], "/out/words.json");
  assert.equal(args[args.indexOf("--model") + 1], "small");
  assert.equal(args[args.indexOf("--device") + 1], "cuda");
});

test("buildTranscribeArgs omits --model/--device when not given", () => {
  const args = buildTranscribeArgs("/in.mp4", "/out.json");
  assert.ok(!args.includes("--model"));
  assert.ok(!args.includes("--device"));
});

test("toEddWords converts raw whisper words to EDD Word[] with emph left false", () => {
  const words = toEddWords([
    { word: "hello", start: 0, end: 0.4 },
    { word: "world", start: 0.4, end: 0.9 },
  ]);
  assert.deepEqual(words, [
    { t: "hello", startS: 0, endS: 0.4, emph: false },
    { t: "world", startS: 0.4, endS: 0.9, emph: false },
  ]);
});

test("resolvePythonBin finds a real interpreter on this machine (Python is present here)", () => {
  const bin = resolvePythonBin();
  assert.ok(bin, "expected a python interpreter to be found on PATH");
  assert.ok(path.isAbsolute(bin!));
});

test("resolvePythonBin honors OPENVIDEO_PYTHON_BIN override", () => {
  const bin = resolvePythonBin(["definitely-not-a-real-python-binary-xyz"]);
  assert.equal(bin, undefined);
});

test("transcribe() runs the REAL bundled Python script against a real audio file and surfaces FasterWhisperNotInstalledError honestly (faster-whisper is not installed on this machine) rather than fabricating a transcript", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ov-transcribe-"));
  const clip = path.join(dir, "clip.wav");
  execSync(`ffmpeg -y -f lavfi -i "sine=frequency=440:duration=1" "${clip}"`, { stdio: "ignore" });

  await assert.rejects(() => transcribe(clip), FasterWhisperNotInstalledError);
});
