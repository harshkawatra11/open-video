import test from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/index.ts";
import type { EDD } from "@openvideo/edd";
import reel from "../../edd/fixtures/reel.edd.json" with { type: "json" };

const base = reel as unknown as EDD;
const clone = (): EDD => structuredClone(base);

test("compiles the reel into a DAG with the expected stages, export terminal", () => {
  const dag = compile(base);
  const ops = dag.nodes.map((n) => n.op);
  assert.ok(ops.includes("cut"));
  assert.ok(ops.includes("tonemap_grade"));
  assert.ok(ops.includes("remotion_render")); // overlay (captions + graphics)
  assert.ok(ops.includes("level_audio"));
  assert.ok(ops.includes("ffmpeg_compose")); // composite
  assert.equal(dag.rootId, "export");
  assert.equal(dag.nodes.at(-1)!.id, "export"); // terminal is last in topo order
});

test("topological order: every node's inputs appear before it", () => {
  const dag = compile(base);
  const seen = new Set<string>();
  for (const n of dag.nodes) {
    for (const inId of n.inputs) {
      // input is either an already-seen node or a source leaf (not a node id)
      const isNode = dag.nodes.some((m) => m.id === inId);
      if (isNode) assert.ok(seen.has(inId), `${n.id} consumed ${inId} before it was produced`);
    }
    seen.add(n.id);
  }
});

test("deterministic: compiling the same EDD twice yields identical keys", () => {
  const a = compile(base);
  const b = compile(base);
  assert.deepEqual(
    a.nodes.map((n) => [n.id, n.key]),
    b.nodes.map((n) => [n.id, n.key]),
  );
});

test("incremental: a caption change re-keys overlay/composite/export but NOT grade/audio", () => {
  const before = compile(base);
  const keyOf = (dag: ReturnType<typeof compile>, id: string) =>
    dag.nodes.find((n) => n.id === id)!.key;

  const edited = clone();
  const caps = edited.timeline.tracks.find((t) => t.kind === "captions")!;
  (caps as any).words[0].t = "LEASE"; // change one caption word
  const after = compile(edited);

  // unchanged upstream branches keep their cache keys (cache hits)
  assert.equal(keyOf(after, "grade:aroll"), keyOf(before, "grade:aroll"));
  assert.equal(keyOf(after, "cut:aroll"), keyOf(before, "cut:aroll"));
  assert.equal(keyOf(after, "audio"), keyOf(before, "audio"));

  // the changed node + everything downstream of it re-key (must re-render)
  assert.notEqual(keyOf(after, "overlay"), keyOf(before, "overlay"));
  assert.notEqual(keyOf(after, "composite"), keyOf(before, "composite"));
  assert.notEqual(keyOf(after, "export"), keyOf(before, "export"));
});

test("incremental: a grade change re-keys grade/composite/export but NOT overlay/audio", () => {
  const before = compile(base);
  const keyOf = (dag: ReturnType<typeof compile>, id: string) =>
    dag.nodes.find((n) => n.id === id)!.key;

  const edited = clone();
  const v = edited.timeline.tracks.find((t) => t.kind === "video")!;
  (v as any).effects[0].spec.vibrance = 0.2; // tweak the grade
  const after = compile(edited);

  assert.equal(keyOf(after, "overlay"), keyOf(before, "overlay"));
  assert.equal(keyOf(after, "audio"), keyOf(before, "audio"));
  assert.notEqual(keyOf(after, "grade:aroll"), keyOf(before, "grade:aroll"));
  assert.notEqual(keyOf(after, "composite"), keyOf(before, "composite"));
  assert.notEqual(keyOf(after, "export"), keyOf(before, "export"));
});

test("a b-roll track gets its own cut node, composited alongside the a-roll with real timing/opacity", () => {
  const edited = clone();
  edited.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: base.sources[0]!.id, inS: 0, outS: 1, atS: [1, 2], opacity: 0.7 }],
  } as any);
  const dag = compile(edited);

  const brollCut = dag.nodes.find((n) => n.id === "broll_cut:b1")!;
  assert.ok(brollCut, "expected a broll_cut:b1 node");
  assert.equal(brollCut.op, "cut");

  const composite = dag.nodes.find((n) => n.id === "composite")!;
  assert.ok(composite.inputs.includes("broll_cut:b1"), "composite must consume the broll cut");
  const layers = composite.params.brollLayers as Array<{ startFrame: number; endFrame: number; opacity: number }>;
  assert.equal(layers.length, 1);
  assert.equal(layers[0]!.opacity, 0.7);
  assert.equal(layers[0]!.startFrame, base.project.fps * 1);
  assert.equal(layers[0]!.endFrame, base.project.fps * 2);

  // broll_cut must appear before composite in topological order
  const idxCut = dag.nodes.findIndex((n) => n.id === "broll_cut:b1");
  const idxComposite = dag.nodes.findIndex((n) => n.id === "composite");
  assert.ok(idxCut < idxComposite);
});

test("adding a b-roll clip does not re-key the unrelated grade/audio branches", () => {
  const before = compile(base);
  const keyOf = (dag: ReturnType<typeof compile>, id: string) => dag.nodes.find((n) => n.id === id)!.key;

  const edited = clone();
  edited.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: base.sources[0]!.id, inS: 0, outS: 1, atS: [1, 2] }],
  } as any);
  const after = compile(edited);

  assert.equal(keyOf(after, "grade:aroll"), keyOf(before, "grade:aroll"));
  assert.equal(keyOf(after, "audio"), keyOf(before, "audio"));
  assert.notEqual(keyOf(after, "composite"), keyOf(before, "composite")); // gained a new input
});

test("tool versions participate in cache keys", () => {
  const a = compile(base, { toolVersions: { ffmpeg: "6.0" } });
  const b = compile(base, { toolVersions: { ffmpeg: "7.0" } });
  const ea = a.nodes.find((n) => n.id === "export")!.key;
  const eb = b.nodes.find((n) => n.id === "export")!.key;
  assert.notEqual(ea, eb);
});

test("a video track's vfx ops chain between cut and grade (one node per op, in order)", () => {
  const edited = clone();
  const v = edited.timeline.tracks.find((t) => t.kind === "video")! as any;
  v.vfx = [
    { id: "v1", kind: "remove_object", atS: [0, 1], provider: "void", prompt: "remove the sign" },
    { id: "v2", kind: "remove_object", atS: [1, 2], provider: "void", prompt: "remove the mic" },
  ];
  const dag = compile(edited);

  const vfx1 = dag.nodes.find((n) => n.id === "vfx:aroll:v1")!;
  const vfx2 = dag.nodes.find((n) => n.id === "vfx:aroll:v2")!;
  const grade = dag.nodes.find((n) => n.id === "grade:aroll")!;
  assert.ok(vfx1 && vfx2);
  assert.equal(vfx1.op, "vfx_remove_object");
  assert.deepEqual(vfx1.inputs, ["cut:aroll"]);
  assert.deepEqual(vfx2.inputs, ["vfx:aroll:v1"]);
  assert.deepEqual(grade.inputs, ["vfx:aroll:v2"]);

  // topological order preserved
  const order = dag.nodes.map((n) => n.id);
  assert.ok(order.indexOf("cut:aroll") < order.indexOf("vfx:aroll:v1"));
  assert.ok(order.indexOf("vfx:aroll:v1") < order.indexOf("vfx:aroll:v2"));
  assert.ok(order.indexOf("vfx:aroll:v2") < order.indexOf("grade:aroll"));
});

test("with no vfx ops, the DAG shape is unchanged (cut feeds grade directly)", () => {
  const dag = compile(base);
  const grade = dag.nodes.find((n) => n.id === "grade:aroll")!;
  assert.deepEqual(grade.inputs, ["cut:aroll"]);
  assert.ok(!dag.nodes.some((n) => n.op === "vfx_remove_object"));
});
