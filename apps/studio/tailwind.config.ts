import type { Config } from "tailwindcss";
import { tailwindPreset } from "@openvideo/design-tokens/tailwind-preset";

export default {
  // The Obsidian token system is the single source of truth (packages/design-tokens, ADR-0012).
  presets: [tailwindPreset as unknown as Config],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
} satisfies Config;
