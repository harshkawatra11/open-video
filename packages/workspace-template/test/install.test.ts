import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { installRemotionDeps } from "../src/index.ts";

// Regression test for a real Windows bug: spawning "pnpm.cmd" directly throws `spawn EINVAL`
// because Node cannot exec a .cmd shim without shell:true. Exercises the real binary.
test("installRemotionDeps actually runs pnpm install (no spawn EINVAL on Windows)", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "openvideo-install-"));
  try {
    // A real (tiny) dependency, not an empty deps object — pnpm legitimately skips creating
    // node_modules when there is nothing to install, which would make this test pass vacuously.
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "0.0.0", dependencies: { "is-odd": "3.0.1" } }),
    );
    await installRemotionDeps(dir);
    assert.ok(existsSync(path.join(dir, "node_modules", "is-odd")), "pnpm install should install the real dependency");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
