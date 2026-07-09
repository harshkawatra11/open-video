/** Brand-kit inputs used to fill in template/remotion/src/theme.ts and the CLAUDE.md brand section. */
export interface BrandKit {
  /** Free-text description of who's on screen, the tone, and any identity rules (required — this
   *  is the single highest-leverage input; a generic value here produces a generic video). */
  brandContext: string;
  colorPrimary?: string;
  colorPrimary2?: string;
  colorAccent?: string;
  colorAccentLight?: string;
  fontDisplayStack?: string;
  fontBodyStack?: string;
  emphasisTerms?: string[];
  fps?: number;
  width?: number;
  height?: number;
}

export const DEFAULT_BRAND: Required<Omit<BrandKit, "brandContext" | "emphasisTerms">> & {
  emphasisTerms: string[];
} = {
  colorPrimary: "#0E1C2B",
  colorPrimary2: "#16293D",
  colorAccent: "#C9A227",
  colorAccentLight: "#E7C766",
  fontDisplayStack: '"Anton", "Arial Black", system-ui, sans-serif',
  fontBodyStack: '"Montserrat", "Inter", system-ui, sans-serif',
  emphasisTerms: [],
  fps: 60,
  width: 1080,
  height: 1920,
};

export function renderThemeTs(brand: BrandKit): string {
  const b = { ...DEFAULT_BRAND, ...brand };
  const terms = b.emphasisTerms.map((t) => JSON.stringify(t)).join(", ");
  return `// Brand kit — generated from the project's brand kit / PRD by workspace-template scaffold.
export const COLORS = {
  primary: "${b.colorPrimary}",
  primary2: "${b.colorPrimary2}",
  accent: "${b.colorAccent}",
  accentLight: "${b.colorAccentLight}",
  white: "#FFFFFF",
  cream: "#F5F1E6",
  ink: "#0A1018",
  red: "#E2473B",
  green: "#2FBF71",
  muted: "#9FB0C0",
};

export const FONTS = {
  display: '${b.fontDisplayStack}',
  body: '${b.fontBodyStack}',
};

export const FPS = ${b.fps};
export const WIDTH = ${b.width};
export const HEIGHT = ${b.height};

// Terms that should always get emphasis styling in captions — edit per-brief.
export const EMPHASIS_TERMS: string[] = [${terms}];
`;
}
