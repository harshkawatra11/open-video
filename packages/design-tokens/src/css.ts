/** Emit the Obsidian tokens as CSS custom properties (for shadcn theming / global styles). */

import { color, radius, shadow, motion } from "./tokens.ts";

function kebab(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();
}

export function toCssVars(prefix = "ov"): string {
  const lines: string[] = [];
  const push = (k: string, v: string) => lines.push(`  --${prefix}-${k}: ${v};`);
  for (const [k, v] of Object.entries(color)) push(`color-${kebab(k)}`, v);
  for (const [k, v] of Object.entries(radius)) push(`radius-${kebab(k)}`, v);
  for (const [k, v] of Object.entries(shadow)) push(`shadow-${kebab(k)}`, v);
  for (const [k, v] of Object.entries(motion)) push(`motion-${kebab(k)}`, v);
  return `:root {\n${lines.join("\n")}\n}\n`;
}
