import test from "node:test";
import assert from "node:assert/strict";
import { lowerEDD, LoweringError } from "../src/index.ts";
import type { EDD, ClipOp, CaptionOp, AudioOp, BrollOp } from "../src/index.ts";
import reel from "../fixtures/reel.edd.json" with { type: "json" };

const valid = reel as unknown as EDD;

test("lowers the sample reel to a frame-exact IR", () => {
  const ir = lowerEDD(valid);
  assert.equal(ir.fps, 60);
  // 64.7s * 60fps = 3882 frames
  assert.equal(ir.durationFrames, 3882);
  assert.equal(ir.tracks.length, 4);
});

test("expands a punch-in into a 2-keyframe scale curve over the clip span", () => {
  const ir = lowerEDD(valid);
  const video = ir.tracks.find((t) => t.kind === "video")!;
  const c1 = video.ops[0] as ClipOp;
  // 0.5s -> 30, 6.2s -> 372  => span 342 frames
  assert.equal(c1.inFrame, 30);
  assert.equal(c1.outFrame, 372);
  assert.equal(c1.scale.length, 2);
  assert.equal(c1.scale[0]!.value, 1.0);
  assert.equal(c1.scale[1]!.value, 1.03);
  assert.equal(c1.scale[1]!.frame, 342);
  assert.equal(c1.scale[0]!.ease, "io");
});

test("converts caption word times to frames and preserves emphasis", () => {
  const ir = lowerEDD(valid);
  const caps = ir.tracks.find((t) => t.kind === "captions")!;
  const w0 = caps.ops[0] as CaptionOp;
  assert.equal(w0.text, "SALE");
  assert.equal(w0.startFrame, Math.round(0.62 * 60)); // 37
  assert.equal(w0.emph, true);
});

test("normalizes audio: loudness target + sfx frame positions", () => {
  const ir = lowerEDD(valid);
  const audio = ir.tracks.find((t) => t.kind === "audio")!;
  const a = audio.ops[0] as AudioOp;
  assert.equal(a.targetLUFS, -14);
  assert.deepEqual(
    a.sfx.map((s) => s.atFrame),
    [0, 372],
  );
});

test("lowers a b-roll track's atS placement and inS/outS to frames, defaulting opacity to 1", () => {
  const withBroll = structuredClone(valid);
  withBroll.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: valid.sources[0]!.id, inS: 0, outS: 2, atS: [1, 3] }],
  } as any);
  const ir = lowerEDD(withBroll);
  const broll = ir.tracks.find((t) => t.kind === "broll")!;
  const op = broll.ops[0] as BrollOp;
  assert.equal(op.inFrame, 0);
  assert.equal(op.outFrame, 120); // 2s * 60fps
  assert.equal(op.startFrame, 60); // 1s * 60fps
  assert.equal(op.endFrame, 180); // 3s * 60fps
  assert.equal(op.opacity, 1);
});

test("lowers a b-roll clip's explicit opacity", () => {
  const withBroll = structuredClone(valid);
  withBroll.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: valid.sources[0]!.id, inS: 0, outS: 2, atS: [1, 3], opacity: 0.6 }],
  } as any);
  const ir = lowerEDD(withBroll);
  const broll = ir.tracks.find((t) => t.kind === "broll")!;
  assert.equal((broll.ops[0] as BrollOp).opacity, 0.6);
});

test("refuses to lower an invalid EDD", () => {
  const bad = structuredClone(valid);
  bad.sources = [];
  assert.throws(() => lowerEDD(bad), LoweringError);
});
