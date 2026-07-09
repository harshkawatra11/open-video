import test from "node:test";
import assert from "node:assert/strict";
import { scaffoldEdd } from "../src/index.ts";
import { validateEDD } from "@openvideo/edd";
import type { Probe } from "@openvideo/edd";

test("scaffoldEdd builds a valid baseline EDD from a probe", () => {
  const probe: Probe = { durationS: 6.5, w: 1080, h: 1920, fps: 60, vcodec: "h264", acodec: "aac" };
  const edd = scaffoldEdd("src_abc", probe, "assets/abc.mp4");
  assert.equal(validateEDD(edd).filter((d) => d.severity === "error").length, 0);
  assert.equal(edd.project.width, 1080);
  assert.equal(edd.project.height, 1920);
  assert.equal(edd.project.fps, 60);
  const video = edd.timeline.tracks.find((t) => t.kind === "video")!;
  assert.equal((video as any).clips[0].outS, 6.5);
  const audio = edd.timeline.tracks.find((t) => t.kind === "audio")! as any;
  assert.equal(audio.voice.loudness.targetLUFS, -14);
});

test("scaffoldEdd adds a tonemap for HDR/HLG sources", () => {
  const probe: Probe = { durationS: 3, w: 1080, h: 1920, fps: 60, color: "hlg/bt2020" };
  const edd = scaffoldEdd("src_hdr", probe, "assets/hdr.mp4");
  const video = edd.timeline.tracks.find((t) => t.kind === "video")! as any;
  assert.equal(video.effects[0].spec.tonemap, "hlg_to_bt709");
});

test("scaffoldEdd falls back to sane defaults for a zero-probe", () => {
  const edd = scaffoldEdd("src_x", { durationS: 0, w: 0, h: 0, fps: 0 }, "assets/x.mp4");
  assert.equal(validateEDD(edd).filter((d) => d.severity === "error").length, 0);
  assert.equal(edd.project.width, 1080);
  assert.equal(edd.project.fps, 30);
});
