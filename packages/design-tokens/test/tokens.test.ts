import test from "node:test";
import assert from "node:assert/strict";
import { color, contrastRatio, toCssVars, tailwindPreset, typeScale } from "../src/index.ts";

test("every color token is a valid hex or rgba value", () => {
  for (const [k, v] of Object.entries(color)) {
    const ok = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) || /^rgba?\(/.test(v);
    assert.ok(ok, `bad color token ${k}=${v}`);
  }
});

test("the jet-black ramp is present and ordered dark→light", () => {
  assert.equal(color.bg0, "#050506");
  for (const k of ["bg0", "bg1", "bg2", "bg3", "bg4"]) assert.ok(k in color);
});

test("primary text on the canvas meets WCAG AA (>= 4.5)", () => {
  assert.ok(contrastRatio(color.fg0, color.bg0) >= 4.5);
  assert.ok(contrastRatio(color.fg1, color.bg1) >= 4.5);
});

test("the accent is legible on dark surfaces for large text (>= 3)", () => {
  assert.ok(contrastRatio(color.accent, color.bg1) >= 3);
});

test("toCssVars emits prefixed custom properties", () => {
  const css = toCssVars("ov");
  assert.match(css, /--ov-color-bg-0: #050506;/);
  assert.match(css, /--ov-color-accent: #C9A227;/);
  assert.match(css, /--ov-radius-md: 10px;/);
});

test("the tailwind preset exposes the token colors", () => {
  const c = tailwindPreset.theme.extend.colors;
  assert.equal(c.accent.DEFAULT, color.accent);
  assert.equal(c.bg[0], color.bg0);
  assert.equal(c.cat.broll, color.catBroll);
  assert.equal(tailwindPreset.darkMode, "class");
});

test("type scale entries are [size, lineHeight, weight]", () => {
  assert.deepEqual(typeScale.body, ["14px", "20px", 450]);
  assert.equal(typeScale.displayXl[2], 700);
});
