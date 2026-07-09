import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDirectorSystemPrompt } from "../src/index.ts";

test("references every MCP tool name so the agent knows its actual toolset", () => {
  const prompt = buildDirectorSystemPrompt({ projectId: "prj_1", mode: "auto" });
  for (const tool of [
    "project_get",
    "edd_get",
    "analyze_footage",
    "transcribe_source",
    "library_search",
    "library_insert",
    "edd_apply_patch",
    "edd_render",
  ]) {
    assert.ok(prompt.includes(tool), `expected prompt to mention ${tool}`);
  }
});

test("includes the project id", () => {
  const prompt = buildDirectorSystemPrompt({ projectId: "prj_abc123", mode: "plan" });
  assert.match(prompt, /prj_abc123/);
});

test("plan mode and auto mode produce different guidance", () => {
  const plan = buildDirectorSystemPrompt({ projectId: "p", mode: "plan" });
  const auto = buildDirectorSystemPrompt({ projectId: "p", mode: "auto" });
  assert.match(plan, /PLAN mode/);
  assert.match(auto, /AUTO mode/);
  assert.notEqual(plan, auto);
});

test("includes STYLE.md content when provided, else a sensible-defaults note", () => {
  const withStyle = buildDirectorSystemPrompt({ projectId: "p", mode: "auto", styleMd: "palette: gold" });
  assert.match(withStyle, /palette: gold/);

  const withoutStyle = buildDirectorSystemPrompt({ projectId: "p", mode: "auto" });
  assert.match(withoutStyle, /No STYLE\.md was found/);
});

test("states the copyright-safety rule", () => {
  const prompt = buildDirectorSystemPrompt({ projectId: "p", mode: "auto" });
  assert.match(prompt, /never invent or reference scraped media/);
});
