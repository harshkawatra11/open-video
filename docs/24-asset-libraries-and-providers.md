# 24 — Asset Libraries & Providers

> The Library layer: fonts, b-roll, music/"discography", SFX, and AI images — browsable, previewable,
> insertable, overridable. A typed **provider registry** (`packages/library`) so sources are pluggable
> (open-design plugin sensibility, doc 15). Decision: ADR-0010. UX: doc 23 §5. Copyright-safety is
> non-negotiable (PRD §4.3): assets are user-supplied, generated, or royalty-free/licensed — never
> scraped; every result carries a license.

## 1. Provider registry (contract)
```ts
type ProviderKind = "font" | "broll" | "music" | "sfx" | "image" | "look";
type Auth = { type: "none" } | { type: "apiKey"; keyId: string }; // keyId resolved from keystore
interface Provider {
  id: string;            // "google-fonts", "pexels", "freesound", "vector-broll", "bundled-sfx", ...
  kind: ProviderKind;
  auth: Auth;
  license: string;       // human + SPDX-ish; shown as a badge
  capabilities: { search: boolean; preview: boolean; fetch: boolean; generate?: boolean };
  search(q: SearchQuery): Promise<AssetHit[]>;
  preview(id: string): Promise<PreviewRef>;   // small/streamable
  fetch(id: string, dest: string): Promise<AssetFile>; // full, cached content-addressed
}
interface AssetHit { providerId; id; kind; title; thumb?; durationS?; license; attribution?; meta }
```
The registry exposes `search(kind,q)` across enabled providers, dedupes, and tags each hit with its
provider + license. A provider is **enabled** iff `auth.type==="none"` or its key exists in the
keystore. Plugins can register new providers via the manifest (doc 15).

## 2. Catalog — keyless now vs key-gated (wired, inactive until keys)
```
kind     KEYLESS (now)                                 KEY-GATED (wired, inactive until key)
-------  --------------------------------------------  -------------------------------------------
font     google-fonts (entire catalog, on-demand)      —
broll    vector-broll (Remotion-generated, on-brand)   pexels, pixabay  (stock video)
music    bundled-music (royalty-free starter set)      free-music-archive / others
sfx      bundled-sfx (royalty-free starter pack)       freesound
image    local-image (only if a local model present)   hosted image APIs (provider-agnostic)
look     bundled-looks (STYLE.md packs)                community registry (later)
```
Key-gated providers appear in the UI with "Add key to enable" → Settings keystore (write-only,
encrypted; daemon-side; ADR-0008/§Security). No scraping, ever.

## 3. Fonts — Font Studio (Google Fonts)
- **Keyless** access to the full Google Fonts catalog: a bundled catalog index (families, categories,
  weights, subsets) + on-demand family load via the Google Fonts **CSS2** endpoint / `@fontsource`.
- UX (doc 23 §5 Fonts tab): search; filter by category (serif/sans/display/handwriting/mono), weight,
  language subset; **live preview on the user's own caption text**; favorites; AI pairing suggestions.
- Selecting a font resolves into STYLE.md `typography`/`caption` tokens and the Remotion caption
  component; fetched font files cache under the project (offline-safe re-render).

## 4. Music / "discography" & SFX
- A browsable **score library**: bundled royalty-free beds (mood/tempo/length tags) now; Freesound/FMA
  key-gated later. Preview = streamed mini-waveform + scrub. Insert → EDD **music track** with
  side-chain ducking under voice (doc 23 §7). SFX cues → EDD `sfx` entries on beats.
- Every track shows license + attribution; attribution is carried into the project (and optional
  end-card credits).

## 5. B-roll
- **vector-broll (keyless):** on-brand motion graphics generated via Remotion from the STYLE.md tokens
  (the copyright-safe default). **Stock (key-gated):** Pexels/Pixabay video.
- Curator/B-roll agent proposes placements synced to the transcript/footage-analysis; the user can
  accept, swap, reposition, or set opacity/blend. Insert → EDD **b-roll track** clip referencing a
  provider asset (cached) or a generated graphic.

## 6. AI images
- **Local (keyless) if a model is present** else **hosted (key-gated)**, behind a provider-agnostic
  `image` interface. Generated stills become project assets (Ken-Burns-able) referenced by the EDD.
  Used for thumbnails, title cards, and texture under graphics. Licensing/safety per provider.

## 7. EDD / data-model additions  (update `packages/edd` + Appendix D)
- `sources[]` gains provider-sourced + generated assets: `{ origin: "user"|"provider"|"generated",
  providerId?, license?, attribution? }`.
- New tracks/refs: **b-roll** track (clips → asset refs, with opacity/blend/transition), **music**
  track (src + targetLUFS + duck), extended **sfx** cues, **caption/typography fontRef**, **image**
  asset refs, and a **vfx** op placeholder (doc 25). Validation + lowering + tests extend accordingly.
- Provenance records provider + license on every inserted asset (auditable, copyright-safe).

## 8. Caching, licensing, safety
- Fetched/previewed assets cache content-addressed under `project/cache` (and a shared cache);
  manifest entries store hash + license + attribution.
- The daemon is the only egress point; provider calls go through the SSRF-guarded proxy; keys live in
  the encrypted keystore and never reach the renderer/agents (ADR-0008).
- The Library UI always shows a **LicenseBadge**; the Director/Curator agent refuses non-safe sources.

## 9. Daemon endpoints (Part E)
`GET /api/library/:kind/search?q=` · `GET /api/library/preview?providerId=&id=` ·
`POST /api/projects/:id/library/insert` · `GET /api/fonts/search` + on-demand fetch ·
`POST /api/images/generate` (if a local image model is present) · keystore write endpoints.
