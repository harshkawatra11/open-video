import test from "node:test";
import assert from "node:assert/strict";
import { validateEDD, isRenderable } from "../src/index.ts";
import type { EDD } from "../src/index.ts";
import reel from "../fixtures/reel.edd.json" with { type: "json" };

const valid = reel as unknown as EDD;

test("the sample reel EDD is valid (no errors)", () => {
  const diags = validateEDD(valid);
  const errors = diags.filter((d) => d.severity === "error");
  assert.equal(errors.length, 0, JSON.stringify(errors, null, 2));
  assert.equal(isRenderable(valid), true);
});

test("flags a clip whose inS >= outS", () => {
  const bad = structuredClone(valid);
  (bad.timeline.tracks[0] as any).clips[0].inS = 10;
  (bad.timeline.tracks[0] as any).clips[0].outS = 5;
  const diags = validateEDD(bad);
  assert.ok(diags.some((d) => d.code === "EDD042" && d.severity === "error"));
  assert.equal(isRenderable(bad), false);
});

test("flags a clip referencing an unknown source", () => {
  const bad = structuredClone(valid);
  (bad.timeline.tracks[0] as any).clips[0].src = "src_missing";
  const diags = validateEDD(bad);
  assert.ok(diags.some((d) => d.code === "EDD041" && d.severity === "error"));
});

test("flags overlapping clips on a video track", () => {
  const bad = structuredClone(valid);
  // make c2 start before c1 ends
  (bad.timeline.tracks[0] as any).clips[1].inS = 3.0;
  const diags = validateEDD(bad);
  assert.ok(diags.some((d) => d.code === "EDD044" && d.severity === "error"));
});

test("flags a transition referencing an unknown clip", () => {
  const bad = structuredClone(valid);
  (bad.timeline.tracks[0] as any).transitions[0].between = ["c1", "c_missing"];
  const diags = validateEDD(bad);
  assert.ok(diags.some((d) => d.code === "EDD046" && d.severity === "error"));
});

test("requires at least one source", () => {
  const bad = structuredClone(valid);
  bad.sources = [];
  const diags = validateEDD(bad);
  assert.ok(diags.some((d) => d.code === "EDD020" && d.severity === "error"));
});

test("warns when an audio track has no loudness target", () => {
  const bad = structuredClone(valid);
  delete (bad.timeline.tracks[3] as any).voice.loudness;
  const diags = validateEDD(bad);
  assert.ok(diags.some((d) => d.code === "EDD060" && d.severity === "warning"));
});

test("a valid b-roll track passes with no errors", () => {
  const withBroll = structuredClone(valid);
  withBroll.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: valid.sources[0]!.id, inS: 0, outS: 2, atS: [1, 3], opacity: 1 }],
  } as any);
  const diags = validateEDD(withBroll);
  assert.equal(diags.filter((d) => d.severity === "error").length, 0, JSON.stringify(diags, null, 2));
});

test("flags a b-roll clip referencing an unknown source", () => {
  const bad = structuredClone(valid);
  bad.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: "src_missing", inS: 0, outS: 2, atS: [1, 3] }],
  } as any);
  const diags = validateEDD(bad);
  assert.ok(diags.some((d) => d.code === "EDD081" && d.severity === "error"));
});

test("flags a b-roll placement where atS start >= end", () => {
  const bad = structuredClone(valid);
  bad.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: valid.sources[0]!.id, inS: 0, outS: 2, atS: [3, 1] }],
  } as any);
  const diags = validateEDD(bad);
  assert.ok(diags.some((d) => d.code === "EDD083" && d.severity === "error"));
});

test("flags an out-of-range b-roll opacity", () => {
  const bad = structuredClone(valid);
  bad.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: valid.sources[0]!.id, inS: 0, outS: 2, atS: [1, 3], opacity: 1.5 }],
  } as any);
  const diags = validateEDD(bad);
  assert.ok(diags.some((d) => d.code === "EDD085" && d.severity === "error"));
});
