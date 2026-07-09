import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runFfmpeg, isAvailable } from "@openvideo/render";
import { scaffoldWorkspace } from "../src/index.ts";

const haveFfmpeg = isAvailable("ffmpeg");

test("scaffoldWorkspace produces a runnable vlawgish-style workspace", { skip: !haveFfmpeg ? "ffmpeg not on PATH" : false }, async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openvideo-wksp-"));
  try {
    const raw = path.join(root, "raw.mp4");
    await runFfmpeg([
      "-y",
      "-f", "lavfi", "-i", "testsrc=size=480x854:rate=30:duration=1",
      "-f", "lavfi", "-i", "sine=frequency=300:duration=1",
      "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", raw,
    ]);

    const projectDir = path.join(root, "reel-test");
    const result = await scaffoldWorkspace({
      projectDir,
      sourceVideoPath: raw,
      prd: "Turn this into a 15s vertical reel.",
      brand: {
        brandContext: "Test Talent — a demo persona, tone: upbeat.",
        emphasisTerms: ["TEST", "DEMO"],
      },
    });

    // Structure matches vlawgish-edit's layout
    assert.ok(existsSync(result.claudeMdPath));
    assert.ok(existsSync(result.prdPath));
    assert.ok(existsSync(result.sourcePath));
    assert.ok(existsSync(path.join(projectDir, "work", "gen_captions.cjs")));
    assert.ok(existsSync(path.join(projectDir, "memory", "learnings.txt")));
    assert.ok(existsSync(path.join(projectDir, "out")));
    assert.ok(existsSync(path.join(projectDir, ".claude", "settings.json")));

    // Regression: a real headless run silently produced zero output for 45+ minutes because the
    // permission rules used `Bash(ffmpeg:*)` (colon) instead of the CLI's actual `Bash(ffmpeg *)`
    // (space) grammar, so every Bash call needed interactive approval that never came headless.
    const settings = JSON.parse(readFileSync(path.join(projectDir, ".claude", "settings.json"), "utf8"));
    const allow: string[] = settings.permissions.allow;
    assert.ok(allow.length > 0, "must have at least one allow rule");
    for (const rule of allow) {
      assert.ok(!/:\*\)$/.test(rule), `rule "${rule}" uses the wrong colon-wildcard syntax (must be "<prefix> *)")`);
    }
    assert.ok(allow.some((r) => r === "Bash(ffmpeg *)"), "ffmpeg must be allowlisted with the space-wildcard syntax");
    // Regression: a second real headless run wrote a fully correct run_edit.ps1 and then stopped
    // instead of executing it, because it invoked commands through the PowerShell tool, which a
    // Bash-only allowlist does not cover.
    assert.ok(allow.some((r) => r === "PowerShell(ffmpeg *)"), "ffmpeg must also be allowlisted under PowerShell(...), not just Bash(...)");
    assert.ok(allow.some((r) => r === "PowerShell(npx remotion *)"), "remotion render must also be allowlisted under PowerShell(...)");
    assert.ok(existsSync(path.join(result.remotionDir, "package.json")));
    assert.ok(existsSync(path.join(result.remotionDir, "src", "Root.tsx")));
    assert.ok(existsSync(path.join(result.remotionDir, "src", "components", "Captions.tsx")));

    // CLAUDE.md substitution actually happened — no leftover placeholder token
    const claudeMd = readFileSync(result.claudeMdPath, "utf8");
    assert.ok(!claudeMd.includes("{{BRAND_CONTEXT}}"), "brand context placeholder must be substituted");
    assert.ok(claudeMd.includes("Test Talent"), "brand context must be present in CLAUDE.md");
    assert.ok(claudeMd.includes("DONE: out/final-edit.mp4"), "completion marker instruction must survive substitution");

    // theme.ts is generated (not left with template tokens)
    const theme = readFileSync(path.join(result.remotionDir, "src", "theme.ts"), "utf8");
    assert.ok(!theme.includes("{{"), "theme.ts must not contain leftover template tokens");
    assert.ok(theme.includes('"TEST"') && theme.includes('"DEMO"'), "emphasis terms must be injected");

    // scaffolding into an existing dir must fail loudly, not silently overwrite
    await assert.rejects(() =>
      scaffoldWorkspace({
        projectDir,
        sourceVideoPath: raw,
        prd: "x",
        brand: { brandContext: "x" },
      })
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
