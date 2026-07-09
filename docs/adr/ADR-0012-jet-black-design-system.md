# ADR-0012: Jet-black agency-grade app design system ("Obsidian") + Google Fonts

- **Status:** Accepted
- **Related:** doc 22, doc 23; ADR-0009; doc 14 (output STYLE.md)

## Context
The app must feel like a world-class production studio — editorial, premium, "unforgettable" — not a
generic AI dashboard. The user explicitly asked for a jet-black experience (Claude/Open-Design
sensibility), maximised typography and brand kit, and Google Fonts for output typography.

## Options considered
1. **A codified token-driven design system ("Obsidian"):** a true jet-black neutral ramp, one
   restrained metallic accent, editorial type scale, motion language, accessible components; the app
   UI fonts are curated+self-hosted, while the *output/project* fonts are the live Google Fonts catalog
   via a Font Studio. Tokens in `packages/design-tokens` + a Tailwind preset.
2. **Ad-hoc styling per screen** — fast start, inevitable inconsistency; not agency-grade.
3. **Adopt an off-the-shelf admin theme** — generic; the opposite of the desired identity.

## Decision
Adopt **Obsidian** (doc 22) as the single source of UI truth, kept distinct from the output STYLE.md
(doc 14). Jet-black base (`#050506…`), warm-gold accent, editorial type, low-saturation category hues,
motion that communicates state, AA accessibility. Output typography uses the **full Google Fonts**
catalog (keyless, on-demand) through Font Studio; selections resolve into STYLE.md + Remotion captions.

## Rationale
A token system guarantees consistency and theming, matches the Next/Tailwind/shadcn stack, and
delivers the premium, restrained, footage-first identity the product needs; Google Fonts gives the
"maximised typography" the user asked for without bloating the app.

## Consequences
- Positive: consistent, premium, accessible, themeable; clear separation of app vs output styling.
- Negative: upfront token + component work; two font systems to manage (app self-hosted vs output GF).
- Mitigations: tokens centralized; Font Studio caches fetched families per project (offline re-render).

## Revisit when
A light theme or a brand refresh is needed (swap the token set; structure already supports it).
