/**
 * OpenVideo — "Obsidian" design tokens (doc 22, ADR-0012). The single source of truth for the app UI
 * (jet-black, agency-grade). Distinct from the output STYLE.md (doc 14). Erasable TS (const objects).
 */

/** Warm-graphite jet-black neutral ramp + accent + semantic + editorial category hues. */
export const color = {
  // canvas → raised surfaces
  bg0: "#050506",
  bg1: "#0A0B0D",
  bg2: "#0E0F12",
  bg3: "#16181D",
  bg4: "#1E2127",
  // hairlines / borders (alpha on white)
  line1: "rgba(255,255,255,0.06)",
  line2: "rgba(255,255,255,0.10)",
  line3: "rgba(255,255,255,0.16)",
  // text
  fg0: "#F4F5F7",
  fg1: "#C2C7CF",
  fg2: "#8A92A0",
  fg3: "#5A626E",
  // accent (warm gold)
  accent: "#C9A227",
  accentHi: "#E7C766",
  accentPress: "#A8851C",
  // semantic
  success: "#2FBF71",
  warn: "#E5A13A",
  error: "#E2473B",
  info: "#4C9BE8",
  // editorial category hues (track/library identity; low-sat usage only)
  catFont: "#B98CFF",
  catBroll: "#4CC2A6",
  catMusic: "#F2A65A",
  catSfx: "#6EA8FF",
  catImage: "#E06CB0",
  catVfx: "#E2473B",
} as const;

/** 4/8px spacing scale (doc 22 §3). Keys are step names; values px. */
export const space = {
  "0": "0px",
  px: "1px",
  "0_5": "2px",
  "1": "4px",
  "1_5": "6px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "5": "20px",
  "6": "24px",
  "8": "32px",
  "10": "40px",
  "12": "48px",
  "16": "64px",
} as const;

export const radius = { sm: "6px", md: "10px", lg: "14px", pill: "999px" } as const;

export const shadow = {
  panel: "0 2px 8px rgba(0,0,0,0.40)",
  popover: "0 8px 24px rgba(0,0,0,0.50)",
  focus: "0 0 0 2px rgba(201,162,39,0.55)",
} as const;

/** App UI fonts (self-hosted via @fontsource). Output fonts come from Google Fonts (Font Studio). */
export const font = {
  display: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
  sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
  mono: ['"Geist Mono"', "ui-monospace", "Consolas", "monospace"],
} as const;

/** Modular type scale: [fontSize, lineHeight, weight]. */
export const typeScale = {
  displayXl: ["44px", "48px", 700],
  display: ["32px", "38px", 700],
  h1: ["24px", "30px", 650],
  h2: ["20px", "26px", 600],
  h3: ["16px", "22px", 600],
  body: ["14px", "20px", 450],
  bodySm: ["13px", "18px", 450],
  label: ["12px", "16px", 550],
  mono: ["13px", "18px", 450],
} as const;

export const motion = {
  durMicro: "120ms",
  durStd: "200ms",
  durLg: "320ms",
  easeStd: "cubic-bezier(.2,.7,.2,1)",
  easeEnter: "cubic-bezier(0,.7,.2,1)",
  easeExit: "cubic-bezier(.4,0,1,1)",
} as const;

export const tokens = { color, space, radius, shadow, font, typeScale, motion } as const;
export type Tokens = typeof tokens;
