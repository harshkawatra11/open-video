import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { planVfx } from "../src/index.ts";
import type { ToolContext } from "../src/index.ts";
import type { DAGNode } from "@openvideo/compiler";

function ctx(): ToolContext {
  return {
    projectDir: "/proj",
    width: 1080,
    height: 1920,
    fps: 30,
    capabilities: { gpu: { nvidia: false }, remotionCompositor: "unhealthy" },
    resolveInput: (id) => `/in/${id}`,
  };
}

function node(overrides: Partial<DAGNode> = {}): DAGNode {
  return {
    id: "vfx:aroll:v1",
    op: "vfx_remove_object",
    inputs: ["cut:aroll"],
    params: { atS: [1, 2], region: { x: 10, y: 20, w: 100, h: 200 }, maskRef: "mask1", prompt: "remove the sign", provider: "void" },
    resource: "gpu",
    key: "abc123",
    output: "cache/blobs/abc123.mp4",
    ...overrides,
  };
}

test("planVfx resolves the input from the DAG node and builds a full spec", () => {
  const plan = planVfx(node(), ctx());
  assert.equal(plan.kind, "vfx");
  assert.equal(plan.inputPath, "/in/cut:aroll");
  assert.equal(plan.outPath, path.join("/proj", "cache/blobs/abc123.mp4"));
  assert.deepEqual(plan.atS, [1, 2]);
  assert.deepEqual(plan.region, { x: 10, y: 20, w: 100, h: 200 });
  assert.equal(plan.maskRef, "mask1");
  assert.equal(plan.prompt, "remove the sign");
  assert.equal(plan.provider, "void");
});

test("planVfx defaults provider to 'void' when omitted", () => {
  const n = node({ params: { atS: [0, 1] } });
  const plan = planVfx(n, ctx());
  assert.equal(plan.provider, "void");
  assert.equal(plan.region, undefined);
});
