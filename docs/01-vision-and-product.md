# 01 — Vision & Product

> Expands PRD §1–§5. The PRD is the source of truth; this doc adds product framing detail.

## One-liner
OpenVideo makes professional video production a conversation: describe intent, get a polished,
platform-ready video — while every decision stays inspectable, reversible, and reproducible.

## The five tenets (with implications)
1. **Intent-first** — language is the interface. *Implication:* the Intent Engine + Director must
   resolve context ("this clip", "the hook") against project state; manual controls exist but are
   never required.
2. **Planning-first** — an explicit, approvable blueprint precedes any frame work. *Implication:*
   plan mode is the default for large operations; the blueprint is structured (becomes the EDD).
3. **Agent-first** — a director + narrow specialists, not one mega-prompt. *Implication:* each agent
   is independently testable, cacheable, retryable.
4. **Compiler-first** — intent → plan → EDD → IR → DAG → render. *Implication:* reproducibility,
   incrementality, and caching come from the architecture, not bolted on.
5. **Explainable & reversible** — every change is attributable, inspectable, reversible, reproducible.
   *Implication:* provenance on EDD nodes + git history + the EDD inspector.

## Personas → what they need
- **Solo creator/educator (primary):** one-sentence reels; no Premiere; trustworthy output. (The PoC
  persona.)
- **Developer/power user:** the cockpit, reproducibility, batch, the plugin SDK.
- **Agency/freelancer:** reusable look systems, templates, fast turnaround.
- **Plugin author:** files-as-extensions (skills/agents/styles/templates/renderers).

## Product principles
- Make the right thing the default (e.g. −14 LUFS, 9:16) but overridable by saying so.
- Determinism where it counts; the only non-determinism is reasoning, captured as data.
- Local-first, cloud-optional; privacy by default.
- Never expose raw complexity unnecessarily; never hide it when asked.
- Respect the user's entitlement (Claude subscription) and hardware (their GPU).

## v1 north star (ADR-0003)
The agentic cockpit, with video as the first pluggable vertical (the productized reel pipeline).
Success = a fresh-machine user goes from drop-clip + one sentence to a shipped reel, no manual tools,
no timeline.

## Success criteria (measurable; see PRD §3.3)
Time-to-first-render, caption sync ≤ 80 ms, render determinism, true incremental re-render, crash
recovery with no committed-state loss.

## Non-goals (see PRD §4)
Not a manual timeline NLE; not a model lab; not hosted SaaS in v1; not an enterprise MAM. No scraping
of copyrighted media; no deceptive deepfakes.
