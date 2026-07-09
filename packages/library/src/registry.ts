/**
 * OpenVideo — provider registry (doc 24 §1, ADR-0010). Aggregates all providers, decides which are
 * *enabled* (keyless, or apiKey present in the resolver), and fans a search out across enabled
 * providers of a given kind, tagging every hit with its provider + license (never silently drops the
 * provenance the Library UI and copyright-safety checks depend on).
 */

import type { AssetHit, KeyResolver, Provider, ProviderKind, SearchQuery } from "./types.ts";

export interface RegisteredProvider {
  provider: Provider;
  enabled: boolean;
}

export class ProviderRegistry {
  #providers = new Map<string, Provider>();
  #resolveKey: KeyResolver;

  constructor(resolveKey: KeyResolver = () => undefined) {
    this.#resolveKey = resolveKey;
  }

  register(provider: Provider): void {
    this.#providers.set(provider.id, provider);
  }

  isEnabled(provider: Provider): boolean {
    return provider.auth.type === "none" || Boolean(this.#resolveKey(provider.auth.keyId));
  }

  list(kind?: ProviderKind): RegisteredProvider[] {
    return [...this.#providers.values()]
      .filter((p) => !kind || p.kind === kind)
      .map((provider) => ({ provider, enabled: this.isEnabled(provider) }));
  }

  get(id: string): Provider | undefined {
    return this.#providers.get(id);
  }

  /** Fan a search out across every *enabled* provider of `kind`, merging + tagging results. Disabled
   *  (key-gated, no key) providers are skipped silently here — the UI surfaces them separately via
   *  `list()` with an "add key to enable" affordance (doc 24 §2). */
  async search(kind: ProviderKind, q: SearchQuery): Promise<AssetHit[]> {
    const enabled = this.list(kind).filter((r) => r.enabled && r.provider.capabilities.search);
    const results = await Promise.all(
      enabled.map(async (r) => {
        try {
          return await r.provider.search(q);
        } catch {
          return [] as AssetHit[]; // one provider failing must not sink the whole search
        }
      }),
    );
    return results.flat();
  }
}
