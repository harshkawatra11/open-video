# ADR-0009: Cockpit UI stack = Next.js + Tailwind + shadcn/ui

- **Status:** Accepted
- **Related:** ADR-0001 (Electron+Next shell); docs 22, 23; PRD §18

## Context
The v0 cockpit is a zero-dependency static HTML/JS page served by the daemon — enough to prove the
pipeline, but far below the agency-grade, Premiere/DaVinci-level studio UX now required (timeline,
panels, library browser, inspector, command palette, jet-black design system, Google-Fonts studio).

## Options considered
1. **Next.js + React + Tailwind + shadcn/ui (+ Radix, Framer Motion, cmdk, @fontsource)** — matches the
   locked Electron+Next target (ADR-0001); a complete, themeable component system; the richest ceiling.
   Con: heaviest dependency install; build step.
2. **Vite + React + Tailwind** — leaner SPA served by the daemon. Con: diverges from the Next target;
   re-tooling later for the Electron+Next path.
3. **Keep zero-dep static, redesign in place** — no install. Con: cannot realistically reach a full
   studio UI (timeline/panels/library); a dead end for this product.

## Decision
Build the studio UI as a **Next.js app in `apps/cockpit`** with Tailwind + shadcn/ui + Radix + Framer
Motion + cmdk + self-hosted fonts (`@fontsource`). It consumes the existing daemon over the
Edit/Session protocol + SSE; the daemon serves the built app in production and proxies in dev. The
Electron shell wraps it later (ADR-0001). Keep the static cockpit until the Next app reaches parity.

## Rationale
Only this option reaches the required quality and aligns with the locked shell decision; shadcn/Radix
give accessible primitives; Tailwind consumes the `packages/design-tokens` preset for the Obsidian
theme; the vercel/shadcn skills support this stack well.

## Consequences
- Positive: agency-grade ceiling; consistent theming; reusable components; clear Electron path.
- Negative: first real third-party dependency surface; build/dev tooling.
- Mitigations: keep the daemon zero-dep + the engine packages offline-testable; cockpit deps isolated
  to `apps/cockpit`; static fallback retained during migration.

## Revisit when
Footprint/build complexity becomes a problem, or a Tauri consolidation is pursued (then re-evaluate).
