import test from "node:test";
import assert from "node:assert/strict";
import { planInstall, parseGpu, parseVersion } from "../src/index.ts";
import type { HardwareProfile } from "../src/index.ts";

function profile(over: Partial<HardwareProfile> = {}): HardwareProfile {
  return {
    os: "windows",
    arch: "x64",
    gpu: { nvidia: false },
    ramGB: 16,
    freeDiskGB: 200,
    tools: {},
    ...over,
  };
}

test("render_reel is all core and needs no consent", () => {
  const plan = planInstall("render_reel", profile());
  assert.equal(plan.needsConsent, false);
  assert.deepEqual(plan.items.map((i) => i.id).sort(), ["ffmpeg", "node", "pnpm", "remotion"]);
  assert.ok(plan.items.every((i) => i.tier === "core"));
});

test("already-installed deps are skipped", () => {
  const plan = planInstall("render_reel", profile({ tools: { ffmpeg: "8.1.1", node: "24.15.0" } }));
  assert.deepEqual(plan.items.map((i) => i.id).sort(), ["pnpm", "remotion"]);
});

test("transcribe without a GPU uses CPU torch, no CUDA, and needs consent", () => {
  const plan = planInstall("transcribe", profile({ gpu: { nvidia: false } }));
  const ids = plan.items.map((i) => i.id);
  assert.ok(ids.includes("torch-cpu"));
  assert.ok(!ids.includes("torch-cuda"));
  assert.ok(!ids.includes("cuda-runtime")); // NVIDIA-only deps dropped
  assert.equal(plan.needsConsent, true);
  assert.ok(plan.totalMB > 1000); // weights dominate
});

test("transcribe with an NVIDIA GPU uses CUDA torch + cuda runtime", () => {
  const plan = planInstall("transcribe", profile({ gpu: { nvidia: true, cudaVersion: "13.2" } }));
  const ids = plan.items.map((i) => i.id);
  assert.ok(ids.includes("torch-cuda"));
  assert.ok(ids.includes("cuda-runtime"));
  assert.ok(!ids.includes("torch-cpu"));
});

test("torch counted as installed via its toolKey", () => {
  const plan = planInstall("transcribe", profile({ tools: { torch: "2.12.1", python: "3.12", whisper: "1.0", "whisper-weights": "large-v3" } }));
  const ids = plan.items.map((i) => i.id);
  assert.ok(!ids.some((id) => id.startsWith("torch")));
});

test("unknown capability throws", () => {
  assert.throws(() => planInstall("teleport", profile()), /unknown capability/);
});

test("parseGpu detects NVIDIA + CUDA version", () => {
  assert.deepEqual(parseGpu("NVIDIA-SMI 596.36   Driver  CUDA Version: 13.2"), { nvidia: true, cudaVersion: "13.2" });
  assert.deepEqual(parseGpu(null), { nvidia: false });
  assert.deepEqual(parseGpu("no gpu here"), { nvidia: false });
});

test("parseVersion extracts a version token", () => {
  assert.equal(parseVersion("ffmpeg version 8.1.1 Copyright"), "8.1.1");
  assert.equal(parseVersion("pnpm 9.15.9"), "9.15.9");
  assert.equal(parseVersion(null), null);
});
