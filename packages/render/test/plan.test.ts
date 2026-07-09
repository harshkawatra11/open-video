import test from "node:test";
import assert from "node:assert/strict";
import { compile } from "@openvideo/compiler";
import { planNode, planDAG, planLevelAudio, sequenceDigitWidth } from "../src/index.ts";
import type { ToolContext, FfmpegPlan, RemotionPlan } from "../src/index.ts";
import type { EDD } from "@openvideo/edd";
import reel from "../../edd/fixtures/reel.edd.json" with { type: "json" };

const base = reel as unknown as EDD;

function ctx(over: Partial<ToolContext> = {}): ToolContext {
  return {
    projectDir: "/proj",
    width: 1080,
    height: 1920,
    fps: 60,
    capabilities: { gpu: { nvidia: false }, remotionCompositor: "unhealthy" },
    resolveInput: (id) => `/in/${id}`,
    ...over,
  };
}

test("every DAG node produces an execution plan", () => {
  const dag = compile(base);
  const plans = planDAG(dag.nodes, ctx());
  assert.equal(plans.length, dag.nodes.length);
  for (const p of plans) assert.ok(p.kind === "ffmpeg" || p.kind === "remotion");
});

test("the grade node yields an ffmpeg plan with the tonemap chain and chosen encoder", () => {
  const dag = compile(base);
  const grade = dag.nodes.find((n) => n.id === "grade:aroll")!;
  const plan = planNode(grade, ctx()) as FfmpegPlan;
  assert.equal(plan.kind, "ffmpeg");
  const i = plan.args.indexOf("-vf");
  assert.ok(i >= 0);
  assert.match(plan.args[i + 1]!, /tonemap=hable/);
  assert.ok(plan.args.includes("libx264")); // CPU fallback in this ctx
});

test("the overlay node falls back to PNG-sequence when the compositor is unhealthy (ADR-0006)", () => {
  const dag = compile(base);
  const overlay = dag.nodes.find((n) => n.op === "remotion_render")!;
  const plan = planNode(overlay, ctx()) as RemotionPlan;
  assert.equal(plan.kind, "remotion");
  assert.equal(plan.mode, "pngseq");
  assert.ok(plan.cliArgs.includes("--sequence"));
  const digits = sequenceDigitWidth(Number((plan.props as { durationFrames?: number }).durationFrames ?? 1));
  assert.ok(plan.assembleArgs && plan.assembleArgs.some((a) => a.includes(`element-%0${digits}d.png`)));
});

test("sequenceDigitWidth matches Remotion's own zero-padding (sized to the highest frame index)", () => {
  assert.equal(sequenceDigitWidth(60), 2); // indices 0..59 -> "59" is 2 digits
  assert.equal(sequenceDigitWidth(1), 1); // index 0 -> "0" is 1 digit
  assert.equal(sequenceDigitWidth(1000), 3); // indices 0..999 -> "999" is 3 digits
});

test("planOverlay references the real Overlay composition entry, not a bare 'remotion' command", () => {
  const dag = compile(base);
  const overlay = dag.nodes.find((n) => n.op === "remotion_render")!;
  const plan = planNode(overlay, ctx()) as RemotionPlan;
  assert.ok(!plan.cliArgs.includes("remotion"));
  assert.ok(plan.cliArgs.some((a) => a.endsWith(".ts") || a.includes("remotion")));
});

test("the overlay node renders natively when the compositor is healthy", () => {
  const dag = compile(base);
  const overlay = dag.nodes.find((n) => n.op === "remotion_render")!;
  const plan = planNode(overlay, ctx({ capabilities: { gpu: { nvidia: true }, remotionCompositor: "healthy" } })) as RemotionPlan;
  assert.equal(plan.mode, "native");
  assert.ok(plan.cliArgs.some((a) => a.includes("prores")));
});

test("the export node muxes audio and applies the platform encode (+faststart, size, aac)", () => {
  const dag = compile(base);
  const exp = dag.nodes.find((n) => n.id === "export")!;
  const plan = planNode(exp, ctx()) as FfmpegPlan;
  assert.equal(plan.kind, "ffmpeg");
  assert.ok(plan.args.includes("+faststart"));
  assert.ok(plan.args.includes("-s") && plan.args.includes("1080x1920"));
  assert.ok(plan.args.includes("aac"));
  assert.ok(plan.args.includes("0:v") && plan.args.includes("1:a"));
});

test("level_audio applies gentle denoise + two-pass loudnorm to the target", () => {
  const dag = compile(base);
  const audio = dag.nodes.find((n) => n.id === "audio")!;
  const plan = planLevelAudio(audio, ctx(), {
    input_i: "-20.98",
    input_tp: "-1.44",
    input_lra: "7.1",
    input_thresh: "-31.2",
  });
  const af = plan.args[plan.args.indexOf("-af") + 1]!;
  assert.match(af, /afftdn=nr=10:nf=-25/);
  assert.match(af, /loudnorm=I=-14:TP=-1\.5:LRA=11/);
  assert.match(af, /measured_I=-20\.98/);
});

test("planComposite builds a scaled, timed overlay filter chain for a b-roll layer", () => {
  const edited = structuredClone(base);
  edited.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: base.sources[0]!.id, inS: 0, outS: 1, atS: [1, 2], opacity: 0.5 }],
  } as any);
  const dag = compile(edited);
  const composite = dag.nodes.find((n) => n.id === "composite")!;
  const plan = planNode(composite, ctx()) as FfmpegPlan;

  assert.equal(plan.kind, "ffmpeg");
  const filterComplex = plan.args[plan.args.indexOf("-filter_complex") + 1]!;
  assert.match(filterComplex, /scale=1080:1920/);
  assert.match(filterComplex, /colorchannelmixer=aa=0\.5/);
  assert.match(filterComplex, /overlay=enable='between\(t,1\.000,2\.000\)'/);
  // one -i per composite input (grade + broll cut + overlay)
  assert.equal(plan.args.filter((a) => a === "-i").length, composite.inputs.length);
});

test("planComposite skips the alpha/colorchannelmixer step when b-roll opacity is fully opaque", () => {
  const edited = structuredClone(base);
  edited.timeline.tracks.push({
    id: "broll",
    kind: "broll",
    clips: [{ id: "b1", src: base.sources[0]!.id, inS: 0, outS: 1, atS: [1, 2] }],
  } as any);
  const dag = compile(edited);
  const composite = dag.nodes.find((n) => n.id === "composite")!;
  const plan = planNode(composite, ctx()) as FfmpegPlan;
  const filterComplex = plan.args[plan.args.indexOf("-filter_complex") + 1]!;
  assert.ok(!filterComplex.includes("colorchannelmixer"));
  assert.match(filterComplex, /overlay=enable='between\(t,1\.000,2\.000\)'/);
});
