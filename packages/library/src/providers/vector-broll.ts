/**
 * OpenVideo — vector b-roll provider (doc 24 §5). The copyright-safe default: on-brand motion-graphic
 * b-roll generated from the project's STYLE.md tokens via Remotion, never scraped stock footage.
 * `fetch` here resolves a *generation descriptor* (template id + params), not a rendered file — the
 * actual frames are produced later by the render pipeline (packages/render + the Remotion adapter),
 * content-addressed like every other DAG node. This keeps the library honest about what it can do
 * offline today vs. what's wired for the render engine to pick up.
 */

import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import type { AssetFile, AssetHit, PreviewRef, Provider, SearchQuery } from "../types.ts";

export interface VectorBrollTemplate {
  id: string;
  title: string;
  tags: string[];
  durationS: number;
}

export const VECTOR_BROLL_CATALOG: VectorBrollTemplate[] = [
  { id: "lower-third-sweep", title: "Lower-third sweep", tags: ["title", "sweep", "clean"], durationS: 2 },
  { id: "kinetic-stat-card", title: "Kinetic stat card", tags: ["data", "stat", "punch"], durationS: 3 },
  { id: "gradient-particle-drift", title: "Gradient particle drift", tags: ["ambient", "texture"], durationS: 5 },
  { id: "line-chart-reveal", title: "Line chart reveal", tags: ["data", "chart"], durationS: 4 },
  { id: "logo-badge-pop", title: "Logo badge pop", tags: ["brand", "badge"], durationS: 1.5 },
];

export function createVectorBrollProvider(catalog: VectorBrollTemplate[] = VECTOR_BROLL_CATALOG): Provider {
  return {
    id: "vector-broll",
    kind: "broll",
    auth: { type: "none" },
    license: "Generated (OpenVideo) — no third-party rights",
    capabilities: { search: true, preview: true, fetch: true, generate: true },
    async search(q: SearchQuery): Promise<AssetHit[]> {
      const needle = (q.q ?? "").toLowerCase();
      const tags = q.tags?.map((t) => t.toLowerCase());
      return catalog
        .filter((t) => {
          const matchesQ = !needle || t.title.toLowerCase().includes(needle) || t.tags.some((x) => x.includes(needle));
          const matchesTags = !tags?.length || tags.some((tg) => t.tags.includes(tg));
          return matchesQ && matchesTags;
        })
        .slice(0, q.limit ?? 50)
        .map((t) => ({
          providerId: "vector-broll",
          id: t.id,
          kind: "broll" as const,
          title: t.title,
          durationS: t.durationS,
          license: "generated",
          meta: { tags: t.tags },
        }));
    },
    async preview(id: string): Promise<PreviewRef> {
      return { url: `openvideo://vector-broll/${id}/preview.json`, mime: "application/json" };
    },
    async fetch(id: string, dest: string): Promise<AssetFile> {
      const entry = catalog.find((t) => t.id === id);
      if (!entry) throw new Error(`vector-broll: unknown template "${id}"`);
      const descriptor = JSON.stringify(
        { kind: "vector-broll", templateId: entry.id, durationS: entry.durationS, tags: entry.tags },
        null,
        2,
      );
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, descriptor, "utf8");
      const hash = createHash("sha256").update(descriptor).digest("hex");
      return { path: dest, hash, license: "generated" };
    },
  };
}
