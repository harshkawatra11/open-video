/**
 * OpenVideo — Google Fonts provider (doc 24 §3, Font Studio). Keyless: the CSS2 endpoint and font
 * files are public. We ship a small bundled catalog index for offline search; `fetch` resolves a
 * family's CSS2 stylesheet on demand (real network call, only performed when actually invoked).
 */

import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import type { AssetFile, AssetHit, PreviewRef, Provider, SearchQuery } from "../types.ts";

export interface FontCatalogEntry {
  family: string;
  category: "serif" | "sans-serif" | "display" | "handwriting" | "monospace";
  weights: number[];
  subsets: string[];
}

/** A small curated starter index (doc 24 §3). The full catalog is fetched on demand, not bundled. */
export const STARTER_FONT_CATALOG: FontCatalogEntry[] = [
  { family: "Inter", category: "sans-serif", weights: [400, 500, 600, 700], subsets: ["latin"] },
  { family: "Space Grotesk", category: "display", weights: [500, 700], subsets: ["latin"] },
  { family: "Anton", category: "display", weights: [400], subsets: ["latin"] },
  { family: "Bebas Neue", category: "display", weights: [400], subsets: ["latin"] },
  { family: "Playfair Display", category: "serif", weights: [400, 700, 900], subsets: ["latin"] },
  { family: "Oswald", category: "sans-serif", weights: [400, 500, 700], subsets: ["latin"] },
  { family: "Caveat", category: "handwriting", weights: [400, 700], subsets: ["latin"] },
  { family: "Geist Mono", category: "monospace", weights: [400, 500], subsets: ["latin"] },
];

/** Builds the Google Fonts CSS2 stylesheet URL for a family + weight set (pure, testable offline). */
export function googleFontsCss2Url(family: string, weights: number[]): string {
  const ital = weights.map((w) => `0,${w}`).join(";");
  const params = new URLSearchParams({ family: `${family}:ital,wght@${ital}`, display: "swap" });
  return `https://fonts.googleapis.com/css2?${params.toString()}`;
}

export function createGoogleFontsProvider(catalog: FontCatalogEntry[] = STARTER_FONT_CATALOG): Provider {
  return {
    id: "google-fonts",
    kind: "font",
    auth: { type: "none" },
    license: "SIL Open Font License 1.1 / Apache-2.0 (per-family; see Google Fonts metadata)",
    capabilities: { search: true, preview: true, fetch: true },
    async search(q: SearchQuery): Promise<AssetHit[]> {
      const needle = (q.q ?? "").toLowerCase();
      return catalog
        .filter((f) => !needle || f.family.toLowerCase().includes(needle) || f.category.includes(needle))
        .slice(0, q.limit ?? 50)
        .map((f) => ({
          providerId: "google-fonts",
          id: f.family,
          kind: "font" as const,
          title: f.family,
          license: "OFL-1.1",
          meta: { category: f.category, weights: f.weights, subsets: f.subsets },
        }));
    },
    async preview(id: string): Promise<PreviewRef> {
      const entry = catalog.find((f) => f.family === id);
      const weights = entry?.weights ?? [400];
      return { url: googleFontsCss2Url(id, weights), mime: "text/css" };
    },
    async fetch(id: string, dest: string): Promise<AssetFile> {
      const entry = catalog.find((f) => f.family === id);
      const weights = entry?.weights ?? [400];
      const url = googleFontsCss2Url(id, weights);
      const res = await globalThis.fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`google-fonts: fetch failed for "${id}" (${res.status})`);
      const css = await res.text();
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, css, "utf8");
      const hash = createHash("sha256").update(css).digest("hex");
      return { path: dest, hash, license: "OFL-1.1", attribution: `Google Fonts — ${id}` };
    },
  };
}
