import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { trustWorkspace } from "../src/index.ts";

// Never touch the real ~/.claude.json in a test — it's the literal file the CLI reads, and may be
// concurrently read/written by the developer's own live Claude Code session. trustWorkspace()
// takes an optional configPath override exactly so tests can use a throwaway file instead.
test("trustWorkspace marks a directory trusted without clobbering the rest of the config", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openvideo-trust-"));
  const configPath = path.join(root, "fake-claude.json");
  const workspaceDir = path.join(root, "some-workspace");
  try {
    // Seed a realistic pre-existing config with an unrelated project, to prove we don't clobber it.
    const seeded = {
      someTopLevelSetting: "keep-me",
      projects: {
        "C:/Users/example/some-other-project": { hasTrustDialogAccepted: false, lastCost: 1.23 },
      },
    };
    writeFileSync(configPath, JSON.stringify(seeded, null, 2), "utf8");

    await trustWorkspace(workspaceDir, configPath);

    const after = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(after.someTopLevelSetting, "keep-me", "unrelated top-level settings must survive");
    assert.equal(
      after.projects["C:/Users/example/some-other-project"].hasTrustDialogAccepted,
      false,
      "unrelated project entries must survive untouched",
    );

    const key = workspaceDir.replace(/\\/g, "/");
    assert.equal(after.projects[key]?.hasTrustDialogAccepted, true, "the scaffolded workspace must be trusted");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("trustWorkspace creates the config file if it doesn't exist yet", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openvideo-trust-"));
  const configPath = path.join(root, "does-not-exist-yet.json");
  const workspaceDir = path.join(root, "ws");
  try {
    assert.ok(!existsSync(configPath));
    await trustWorkspace(workspaceDir, configPath);
    const after = JSON.parse(readFileSync(configPath, "utf8"));
    const key = workspaceDir.replace(/\\/g, "/");
    assert.equal(after.projects[key]?.hasTrustDialogAccepted, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
