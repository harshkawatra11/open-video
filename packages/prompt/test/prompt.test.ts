import test from "node:test";
import assert from "node:assert/strict";
import { buildRefineInput, loadRefineTemplate, isPlaceholderTemplate, DEFAULT_REFINE_TEMPLATE } from "../src/index.ts";

test("buildRefineInput substitutes the {{USER_PROMPT}} token", () => {
  const out = buildRefineInput("before {{USER_PROMPT}} after", "make a reel");
  assert.equal(out, "before make a reel after");
});

test("buildRefineInput appends the brief when there is no token", () => {
  const out = buildRefineInput("TEMPLATE", "make a reel");
  assert.match(out, /TEMPLATE/);
  assert.match(out, /USER BRIEF:\nmake a reel/);
});

test("loadRefineTemplate falls back to the built-in placeholder", () => {
  const t = loadRefineTemplate({ path: "C:/nope/missing.md", repoRoot: "C:/nope" });
  assert.equal(t.source, "(built-in placeholder)");
  assert.equal(t.isPlaceholder, true);
});

test("the default template is recognizably a placeholder", () => {
  assert.equal(isPlaceholderTemplate(DEFAULT_REFINE_TEMPLATE), true);
  assert.match(DEFAULT_REFINE_TEMPLATE, /\{\{USER_PROMPT\}\}/);
});
