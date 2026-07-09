/**
 * OpenVideo — bundled STYLE.md "look" packs (doc 24 §2, kind "look"). Keyless. Each look is a named
 * bundle of STYLE.md token overrides (palette/typography/caption/motion/grade) the Brand Kit editor
 * can apply wholesale, then the user tweaks.
 */

import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import type { AssetFile, AssetHit, PreviewRef, Provider, SearchQuery } from "../types.ts";

export interface LookPack {
  id: string;
  title: string;
  tags: string[];
  style: Record<string, unknown>;
}

export const BUNDLED_LOOKS_CATALOG: LookPack[] = [
  {
    id: "editorial-gold",
    title: "Editorial Gold",
    tags: ["premium", "editorial"],
    style: { palette: { bg: "#0E1C2B", fg: "#FFFFFF", accent: "#C9A227" }, typography: { display: "Anton", body: "Inter" } },
  },
  {
    id: "high-energy-reel",
    title: "High-Energy Reel",
    tags: ["punchy", "social"],
    style: { palette: { bg: "#0A0A0A", fg: "#FFFFFF", accent: "#FF3B30" }, motion: { punchInAmplitude: 0.06 } },
  },
  {
    id: "muted-documentary",
    title: "Muted Documentary",
    tags: ["calm", "cinematic"],
    style: { palette: { bg: "#111318", fg: "#E9E9E9", accent: "#7FA6C9" }, grade: { defaults: "gentle desaturation" } },
  },
];

export function createBundledLooksProvider(catalog: LookPack[] = BUNDLED_LOOKS_CATALOG): Provider {
  return {
    id: "bundled-looks",
    kind: "look",
    auth: { type: "none" },
    license: "OpenVideo starter packs — no third-party rights",
    capabilities: { search: true, preview: true, fetch: true },
    async search(q: SearchQuery): Promise<AssetHit[]> {
      const needle = (q.q ?? "").toLowerCase();
      return catalog
        .filter((l) => !needle || l.title.toLowerCase().includes(needle) || l.tags.some((t) => t.includes(needle)))
        .slice(0, q.limit ?? 50)
        .map((l) => ({
          providerId: "bundled-looks",
          id: l.id,
          kind: "look" as const,
          title: l.title,
          license: "generated",
          meta: { tags: l.tags },
        }));
    },
    async preview(id: string): Promise<PreviewRef> {
      return { url: `openvideo://bundled-looks/${id}/preview.json`, mime: "application/json" };
    },
    async fetch(id: string, dest: string): Promise<AssetFile> {
      const entry = catalog.find((l) => l.id === id);
      if (!entry) throw new Error(`bundled-looks: unknown look "${id}"`);
      const json = JSON.stringify(entry.style, null, 2);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, json, "utf8");
      return { path: dest, hash: createHash("sha256").update(json).digest("hex"), license: "generated" };
    },
  };
}
