# ADR-0003: Agentic cockpit first; video as the first pluggable vertical

- **Status:** Accepted
- **Related:** PRD §1.4, §5, §18, §26, §30

## Context
The grand vision spans an agentic shell, a video engine, and a design/look system. We must choose
what the first shippable slice optimizes for. The reusable, hard part is the "cockpit" (CLI
integration, terminal, control surface, usage meter, installer, workspace). Video is the workflow
that proves it useful, and we already have a working video pipeline (the PoC).

## Options considered
1. **Cockpit first; video as the first vertical** — build the reusable spine, then prove it with
   the reel pipeline as the flagship plugin. Most reusable; clear path to other verticals.
2. **Video-first NLE** — aim straight at deep editing. Most differentiated but largest, slowest v1.
3. **Cockpit only** — ship the shell with no flagship vertical. Reusable but unimpressive.

## Decision
**Cockpit first, with video shipping as the first pluggable vertical** (the productized reel
pipeline). The cockpit (chat + live terminal + model/effort/mode controls + usage meter + media
drop + Installation Agent) is the foundation; the video vertical demonstrates the wow.

## Rationale
Builds the hard reusable core once, de-risks the integration layer early, and still delivers a
jaw-dropping demo via the proven reel pipeline. Other verticals (long-form, design, docs) plug into
the same spine later.

## Consequences
- Positive: reusable architecture; early validation of the agent backbone; clear extensibility.
- Negative: slightly less "instant magic" on day one than a pure video demo.
- Mitigations: ship the reel vertical in the same milestone (Phase 2) so the demo lands.

## Revisit when
If user feedback shows the video vertical should absorb the product identity entirely.
