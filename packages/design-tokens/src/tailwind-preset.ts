/** Tailwind preset consuming the Obsidian tokens (imported by apps/cockpit tailwind.config). */

import { color, radius, shadow, font, motion, space } from "./tokens.ts";

export const tailwindPreset = {
  darkMode: "class" as const,
  theme: {
    extend: {
      colors: {
        bg: { 0: color.bg0, 1: color.bg1, 2: color.bg2, 3: color.bg3, 4: color.bg4 },
        line: { 1: color.line1, 2: color.line2, 3: color.line3 },
        fg: { 0: color.fg0, 1: color.fg1, 2: color.fg2, 3: color.fg3 },
        accent: { DEFAULT: color.accent, hi: color.accentHi, press: color.accentPress },
        success: color.success,
        warn: color.warn,
        error: color.error,
        info: color.info,
        cat: {
          font: color.catFont,
          broll: color.catBroll,
          music: color.catMusic,
          sfx: color.catSfx,
          image: color.catImage,
          vfx: color.catVfx,
        },
      },
      spacing: { ...space },
      borderRadius: { sm: radius.sm, md: radius.md, lg: radius.lg, pill: radius.pill },
      boxShadow: { panel: shadow.panel, popover: shadow.popover },
      fontFamily: { display: font.display, sans: font.sans, mono: font.mono },
      transitionTimingFunction: { std: motion.easeStd, enter: motion.easeEnter, exit: motion.easeExit },
      transitionDuration: { micro: "120", std: "200", lg: "320" },
    },
  },
};

export default tailwindPreset;
