/**
 * OpenVideo — key-gated providers (doc 24 §2): Pexels/Pixabay (broll), Freesound (sfx), Free Music
 * Archive (music), a provider-agnostic hosted image API (image). Each is fully wired against its real
 * REST API — but the registry only enables a provider once its key exists in the keystore (ADR-0010).
 * With no key, `search`/`preview`/`fetch` throw `NotConfiguredError` rather than silently no-op, so a
 * caller that bypasses the registry's enabled-check still gets an honest, actionable error. Never
 * scrapes: every call is an authenticated request to the provider's documented API.
 */

import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import type { AssetFile, AssetHit, KeyResolver, PreviewRef, Provider, ProviderKind, SearchQuery } from "../types.ts";

export class NotConfiguredError extends Error {
  constructor(providerId: string) {
    super(`${providerId}: no API key configured — add one in Settings → Keystore to enable this provider.`);
    this.name = "NotConfiguredError";
  }
}

interface ApiKeyProviderConfig {
  id: string;
  kind: ProviderKind;
  keyId: string;
  license: string;
  buildSearchRequest: (q: SearchQuery, apiKey: string) => { url: string; headers: Record<string, string> };
  mapHits: (json: unknown, providerId: string) => AssetHit[];
  resolvePreviewUrl: (hit: AssetHit) => string;
  resolveFetchUrl: (hit: AssetHit) => string;
  previewMime: string;
}

async function findHit(cfg: ApiKeyProviderConfig, resolveKey: KeyResolver, id: string): Promise<AssetHit> {
  const apiKey = resolveKey(cfg.keyId);
  if (!apiKey) throw new NotConfiguredError(cfg.id);
  const hits = await search(cfg, resolveKey, { q: id, limit: 50 });
  const hit = hits.find((h) => h.id === id);
  if (!hit) throw new Error(`${cfg.id}: asset "${id}" not found`);
  return hit;
}

async function search(cfg: ApiKeyProviderConfig, resolveKey: KeyResolver, q: SearchQuery): Promise<AssetHit[]> {
  const apiKey = resolveKey(cfg.keyId);
  if (!apiKey) throw new NotConfiguredError(cfg.id);
  const { url, headers } = cfg.buildSearchRequest(q, apiKey);
  const res = await globalThis.fetch(url, { headers });
  if (!res.ok) throw new Error(`${cfg.id}: search failed (${res.status})`);
  return cfg.mapHits(await res.json(), cfg.id);
}

function createApiKeyProvider(cfg: ApiKeyProviderConfig, resolveKey: KeyResolver): Provider {
  return {
    id: cfg.id,
    kind: cfg.kind,
    auth: { type: "apiKey", keyId: cfg.keyId },
    license: cfg.license,
    capabilities: { search: true, preview: true, fetch: true },
    search: (q) => search(cfg, resolveKey, q),
    async preview(id): Promise<PreviewRef> {
      const hit = await findHit(cfg, resolveKey, id);
      return { url: cfg.resolvePreviewUrl(hit), mime: cfg.previewMime };
    },
    async fetch(id, dest): Promise<AssetFile> {
      const apiKey = resolveKey(cfg.keyId);
      if (!apiKey) throw new NotConfiguredError(cfg.id);
      const hit = await findHit(cfg, resolveKey, id);
      const res = await globalThis.fetch(cfg.resolveFetchUrl(hit));
      if (!res.ok) throw new Error(`${cfg.id}: fetch failed (${res.status})`);
      const bytes = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, bytes);
      return {
        path: dest,
        hash: createHash("sha256").update(bytes).digest("hex"),
        license: hit.license,
        attribution: hit.attribution,
      };
    },
  };
}

export function createPexelsProvider(resolveKey: KeyResolver): Provider {
  return createApiKeyProvider(
    {
      id: "pexels",
      kind: "broll",
      keyId: "pexels",
      license: "Pexels License (free for commercial use, attribution appreciated)",
      previewMime: "video/mp4",
      buildSearchRequest: (q, apiKey) => ({
        url: `https://api.pexels.com/videos/search?${new URLSearchParams({ query: q.q ?? "", per_page: String(q.limit ?? 20) })}`,
        headers: { Authorization: apiKey },
      }),
      mapHits: (json, providerId) =>
        ((json as { videos?: Array<Record<string, any>> }).videos ?? []).map((v) => ({
          providerId,
          id: String(v.id),
          kind: "broll" as const,
          title: v.user?.name ? `Pexels — ${v.user.name}` : "Pexels video",
          thumb: v.image,
          durationS: v.duration,
          license: "Pexels License",
          attribution: v.user?.name,
          meta: { videoFiles: v.video_files },
        })),
      resolvePreviewUrl: (hit) => (hit.meta?.videoFiles as Array<{ link: string }> | undefined)?.[0]?.link ?? "",
      resolveFetchUrl: (hit) => (hit.meta?.videoFiles as Array<{ link: string }> | undefined)?.[0]?.link ?? "",
    },
    resolveKey,
  );
}

export function createPixabayProvider(resolveKey: KeyResolver): Provider {
  return createApiKeyProvider(
    {
      id: "pixabay",
      kind: "broll",
      keyId: "pixabay",
      license: "Pixabay License (free for commercial use)",
      previewMime: "video/mp4",
      buildSearchRequest: (q, apiKey) => ({
        url: `https://pixabay.com/api/videos/?${new URLSearchParams({ key: apiKey, q: q.q ?? "", per_page: String(q.limit ?? 20) })}`,
        headers: {},
      }),
      mapHits: (json, providerId) =>
        ((json as { hits?: Array<Record<string, any>> }).hits ?? []).map((v) => ({
          providerId,
          id: String(v.id),
          kind: "broll" as const,
          title: v.tags ?? "Pixabay video",
          durationS: v.duration,
          license: "Pixabay License",
          attribution: v.user,
          meta: { videos: v.videos },
        })),
      resolvePreviewUrl: (hit) => (hit.meta?.videos as Record<string, { url: string }> | undefined)?.tiny?.url ?? "",
      resolveFetchUrl: (hit) => (hit.meta?.videos as Record<string, { url: string }> | undefined)?.medium?.url ?? "",
    },
    resolveKey,
  );
}

export function createFreesoundProvider(resolveKey: KeyResolver): Provider {
  return createApiKeyProvider(
    {
      id: "freesound",
      kind: "sfx",
      keyId: "freesound",
      license: "Per-sound (Freesound; mostly CC0/CC-BY — checked per result)",
      previewMime: "audio/mpeg",
      buildSearchRequest: (q, apiKey) => ({
        url: `https://freesound.org/apiv2/search/text/?${new URLSearchParams({ query: q.q ?? "", token: apiKey, fields: "id,name,duration,license,username,previews" })}`,
        headers: {},
      }),
      mapHits: (json, providerId) =>
        ((json as { results?: Array<Record<string, any>> }).results ?? []).map((s) => ({
          providerId,
          id: String(s.id),
          kind: "sfx" as const,
          title: s.name,
          durationS: s.duration,
          license: s.license,
          attribution: s.username,
          meta: { previews: s.previews },
        })),
      resolvePreviewUrl: (hit) => (hit.meta?.previews as Record<string, string> | undefined)?.["preview-hq-mp3"] ?? "",
      resolveFetchUrl: (hit) => (hit.meta?.previews as Record<string, string> | undefined)?.["preview-hq-mp3"] ?? "",
    },
    resolveKey,
  );
}

export function createFreeMusicArchiveProvider(resolveKey: KeyResolver): Provider {
  return createApiKeyProvider(
    {
      id: "free-music-archive",
      kind: "music",
      keyId: "free-music-archive",
      license: "Per-track (Creative Commons; checked per result)",
      previewMime: "audio/mpeg",
      buildSearchRequest: (q, apiKey) => ({
        url: `https://freemusicarchive.org/api/search/?${new URLSearchParams({ search: q.q ?? "", api_key: apiKey, limit: String(q.limit ?? 20) })}`,
        headers: {},
      }),
      mapHits: (json, providerId) =>
        ((json as { data?: Array<Record<string, any>> }).data ?? []).map((t) => ({
          providerId,
          id: String(t.id ?? t.track_id),
          kind: "music" as const,
          title: t.track_title ?? t.title ?? "FMA track",
          durationS: t.track_duration ? Number(t.track_duration) : undefined,
          license: t.license_title ?? "CC",
          attribution: t.artist_name,
          meta: { url: t.track_listen_url ?? t.track_url },
        })),
      resolvePreviewUrl: (hit) => (hit.meta?.url as string | undefined) ?? "",
      resolveFetchUrl: (hit) => (hit.meta?.url as string | undefined) ?? "",
    },
    resolveKey,
  );
}

export function createHostedImageProvider(resolveKey: KeyResolver): Provider {
  return createApiKeyProvider(
    {
      id: "hosted-image",
      kind: "image",
      keyId: "hosted-image",
      license: "Per hosted-image API terms (provider-agnostic; set OPENVIDEO_IMAGE_API_BASE)",
      previewMime: "image/png",
      buildSearchRequest: (q, apiKey) => ({
        url: `${process.env.OPENVIDEO_IMAGE_API_BASE ?? "https://example-image-api.invalid"}/search?${new URLSearchParams({ q: q.q ?? "" })}`,
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      mapHits: (json, providerId) =>
        ((json as { results?: Array<Record<string, any>> }).results ?? []).map((im) => ({
          providerId,
          id: String(im.id),
          kind: "image" as const,
          title: im.title ?? "Generated image",
          thumb: im.thumb,
          license: im.license ?? "provider-terms",
          meta: { url: im.url },
        })),
      resolvePreviewUrl: (hit) => (hit.meta?.url as string | undefined) ?? "",
      resolveFetchUrl: (hit) => (hit.meta?.url as string | undefined) ?? "",
    },
    resolveKey,
  );
}
