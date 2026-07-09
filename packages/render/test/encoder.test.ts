import test from "node:test";
import assert from "node:assert/strict";
import { selectVideoEncoder, selectRenderPath, gradeFilter } from "../src/index.ts";
import type { Effect } from "@openvideo/edd";

test("selectVideoEncoder: NVENC when NVIDIA present, else libx264", () => {
  assert.equal(selectVideoEncoder({ gpu: { nvidia: true }, remotionCompositor: "unknown" }), "h264_nvenc");
  assert.equal(selectVideoEncoder({ gpu: { nvidia: false }, remotionCompositor: "unknown" }), "libx264");
});

test("selectRenderPath: native only when compositor is healthy (ADR-0006)", () => {
  assert.equal(selectRenderPath({ gpu: { nvidia: false }, remotionCompositor: "healthy" }), "native");
  assert.equal(selectRenderPath({ gpu: { nvidia: false }, remotionCompositor: "unhealthy" }), "pngseq");
  assert.equal(selectRenderPath({ gpu: { nvidia: false }, remotionCompositor: "unknown" }), "pngseq");
});

test("gradeFilter emits the HLG->Rec.709 tonemap chain + grade", () => {
  const effects: Effect[] = [
    { type: "color", spec: { tonemap: "hlg_to_bt709", contrast: "s_curve_light", vibrance: 0.1, sharpen: 0.6 } },
  ];
  const vf = gradeFilter(effects);
  assert.match(vf, /zscale=t=linear:npl=100/);
  assert.match(vf, /tonemap=hable:desat=0/);
  assert.match(vf, /zscale=t=bt709:m=bt709:r=tv/);
  assert.match(vf, /curves=preset=medium_contrast/);
  assert.match(vf, /vibrance=intensity=0\.1/);
  assert.match(vf, /unsharp=5:5:0\.6/);
});

test("gradeFilter is a passthrough (null) when there is no color spec", () => {
  assert.equal(gradeFilter([]), "null");
});
