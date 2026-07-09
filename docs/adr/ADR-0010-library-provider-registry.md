# ADR-0010: Asset libraries via a typed provider registry (copyright-safe, keystore-gated)

- **Status:** Accepted
- **Related:** doc 24; ADR-0008 (local-first/keystore); PRD §4.3 (copyright-safety), §20 (plugins)

## Context
The product must offer huge, browsable libraries — fonts, b-roll, music/"discography", SFX, AI images —
serving both the auto user (agent pulls assets) and the operator (manual browse/insert). Sources vary
in auth (keyless vs API-key) and license; copyright-safety is non-negotiable.

## Options considered
1. **Typed provider registry** (`packages/library`): each source is a `Provider` (kind/auth/license/
   search/preview/fetch); keyless providers enabled now, key-gated providers wired-but-inactive until a
   key exists in the encrypted keystore; every result carries a license badge; plugins can add providers.
2. **Hardcode a few sources** — simplest; not extensible; mixes concerns; poor for the "everything" goal.
3. **Aggregator API** — one third-party meta-provider. Con: dependency/licensing lock-in; less control.

## Decision
Adopt the **typed provider registry**. Ship **keyless** providers now (Google Fonts on-demand,
Remotion vector b-roll, bundled royalty-free SFX/music, local AI-image if present); wire **key-gated**
providers (Pexels/Pixabay, Freesound, hosted image APIs) inactive until keys are added. Never scrape;
surface license + attribution on every asset; the daemon is the only egress (SSRF-guarded); keys live
in the keystore and never reach the renderer/agents.

## Rationale
Extensible, safe, and works today without keys; matches the open-design plugin model; keeps the
copyright-safety invariant enforceable at the registry boundary.

## Consequences
- Positive: extensible libraries; works keyless today; auditable licensing; plugin-friendly.
- Negative: per-provider adapter work; key management UX.
- Mitigations: a small provider interface; bundled keyless defaults; keystore UI in Settings.

## Revisit when
A community provider marketplace opens (formalize signing/trust for third-party providers).
