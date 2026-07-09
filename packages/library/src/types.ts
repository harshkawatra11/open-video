/**
 * OpenVideo — asset library provider contract (doc 24 §1, ADR-0010). Every source of fonts, b-roll,
 * music, SFX, images, or STYLE "looks" implements this so the Library UI and the Curator agent can
 * treat them uniformly, regardless of auth or backing service.
 */

export type ProviderKind = "font" | "broll" | "music" | "sfx" | "image" | "look";

export type Auth = { type: "none" } | { type: "apiKey"; keyId: string };

export interface SearchQuery {
  q?: string;
  tags?: string[];
  limit?: number;
}

export interface AssetHit {
  providerId: string;
  id: string;
  kind: ProviderKind;
  title: string;
  thumb?: string;
  durationS?: number;
  license: string;
  attribution?: string;
  meta?: Record<string, unknown>;
}

export interface PreviewRef {
  url: string;
  mime: string;
}

export interface AssetFile {
  path: string;
  hash: string;
  license: string;
  attribution?: string;
}

export interface ProviderCapabilities {
  search: boolean;
  preview: boolean;
  fetch: boolean;
  generate?: boolean;
}

export interface Provider {
  id: string;
  kind: ProviderKind;
  auth: Auth;
  license: string;
  capabilities: ProviderCapabilities;
  search(q: SearchQuery): Promise<AssetHit[]>;
  preview(id: string): Promise<PreviewRef>;
  fetch(id: string, dest: string): Promise<AssetFile>;
}

/** Resolves whether an apiKey-gated provider currently has its key present. Injected so the registry
 *  never touches the keystore's crypto directly (kept in ./keystore.ts). */
export type KeyResolver = (keyId: string) => string | undefined;
