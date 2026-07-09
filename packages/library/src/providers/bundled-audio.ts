/**
 * OpenVideo — bundled royalty-free music + SFX starter providers (doc 24 §2/§4). Keyless, always on.
 * The catalog entries below are synthesized placeholder tones (real, playable WAV bytes) standing in
 * for a licensed royalty-free pack — swap `synthSineWav` for real bundled audio files without changing
 * the Provider contract or any caller.
 */

import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import type { AssetFile, AssetHit, PreviewRef, Provider, SearchQuery } from "../types.ts";
import { synthSineWav } from "../wav.ts";

export interface MusicCatalogEntry {
  id: string;
  title: string;
  mood: string;
  tempoBpm: number;
  durationS: number;
  freqHz: number;
}

export interface SfxCatalogEntry {
  id: string;
  title: string;
  tags: string[];
  durationS: number;
  freqHz: number;
}

export const BUNDLED_MUSIC_CATALOG: MusicCatalogEntry[] = [
  { id: "uplift-loop-01", title: "Uplift Loop 01", mood: "uplifting", tempoBpm: 120, durationS: 8, freqHz: 220 },
  { id: "tension-build-01", title: "Tension Build 01", mood: "tense", tempoBpm: 90, durationS: 8, freqHz: 110 },
  { id: "calm-ambient-01", title: "Calm Ambient 01", mood: "calm", tempoBpm: 70, durationS: 8, freqHz: 165 },
  { id: "corporate-drive-01", title: "Corporate Drive 01", mood: "confident", tempoBpm: 128, durationS: 8, freqHz: 196 },
];

export const BUNDLED_SFX_CATALOG: SfxCatalogEntry[] = [
  { id: "whoosh-soft", title: "Whoosh (soft)", tags: ["transition", "whoosh"], durationS: 0.6, freqHz: 880 },
  { id: "pop-clean", title: "Pop (clean)", tags: ["ui", "pop"], durationS: 0.2, freqHz: 660 },
  { id: "click-tick", title: "Click / tick", tags: ["ui", "click"], durationS: 0.12, freqHz: 990 },
  { id: "riser-short", title: "Riser (short)", tags: ["transition", "riser"], durationS: 1.2, freqHz: 440 },
];

function fetchTone(freqHz: number, durationS: number, dest: string, license: string): AssetFile {
  const wav = synthSineWav({ freqHz, durationS });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, wav);
  const hash = createHash("sha256").update(wav).digest("hex");
  return { path: dest, hash, license, attribution: "OpenVideo starter pack (placeholder tone)" };
}

export function createBundledMusicProvider(catalog: MusicCatalogEntry[] = BUNDLED_MUSIC_CATALOG): Provider {
  return {
    id: "bundled-music",
    kind: "music",
    auth: { type: "none" },
    license: "Royalty-free starter set (OpenVideo placeholder tones)",
    capabilities: { search: true, preview: true, fetch: true },
    async search(q: SearchQuery): Promise<AssetHit[]> {
      const needle = (q.q ?? "").toLowerCase();
      return catalog
        .filter((m) => !needle || m.title.toLowerCase().includes(needle) || m.mood.includes(needle))
        .slice(0, q.limit ?? 50)
        .map((m) => ({
          providerId: "bundled-music",
          id: m.id,
          kind: "music" as const,
          title: m.title,
          durationS: m.durationS,
          license: "royalty-free",
          meta: { mood: m.mood, tempoBpm: m.tempoBpm },
        }));
    },
    async preview(id: string): Promise<PreviewRef> {
      return { url: `openvideo://bundled-music/${id}/preview.wav`, mime: "audio/wav" };
    },
    async fetch(id: string, dest: string): Promise<AssetFile> {
      const entry = catalog.find((m) => m.id === id);
      if (!entry) throw new Error(`bundled-music: unknown track "${id}"`);
      return fetchTone(entry.freqHz, entry.durationS, dest, "royalty-free");
    },
  };
}

export function createBundledSfxProvider(catalog: SfxCatalogEntry[] = BUNDLED_SFX_CATALOG): Provider {
  return {
    id: "bundled-sfx",
    kind: "sfx",
    auth: { type: "none" },
    license: "Royalty-free starter set (OpenVideo placeholder tones)",
    capabilities: { search: true, preview: true, fetch: true },
    async search(q: SearchQuery): Promise<AssetHit[]> {
      const needle = (q.q ?? "").toLowerCase();
      const tags = q.tags?.map((t) => t.toLowerCase());
      return catalog
        .filter((s) => {
          const matchesQ = !needle || s.title.toLowerCase().includes(needle) || s.tags.some((t) => t.includes(needle));
          const matchesTags = !tags?.length || tags.some((tg) => s.tags.includes(tg));
          return matchesQ && matchesTags;
        })
        .slice(0, q.limit ?? 50)
        .map((s) => ({
          providerId: "bundled-sfx",
          id: s.id,
          kind: "sfx" as const,
          title: s.title,
          durationS: s.durationS,
          license: "royalty-free",
          meta: { tags: s.tags },
        }));
    },
    async preview(id: string): Promise<PreviewRef> {
      return { url: `openvideo://bundled-sfx/${id}/preview.wav`, mime: "audio/wav" };
    },
    async fetch(id: string, dest: string): Promise<AssetFile> {
      const entry = catalog.find((s) => s.id === id);
      if (!entry) throw new Error(`bundled-sfx: unknown cue "${id}"`);
      return fetchTone(entry.freqHz, entry.durationS, dest, "royalty-free");
    },
  };
}
