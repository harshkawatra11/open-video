# ADR-0011: External models via tiered MCP adapters (VOID + claude-video now; others deferred)

- **Status:** Accepted
- **Related:** doc 25; ADR-0004 (tiered install); ADR-0002/§MCP; PRD §4.3

## Context
The user wants to fold in several open-source models. They vary wildly in weight and value: footage
vision-analysis is light and high-leverage; object-removal is heavy/GPU; OCR and TTS are heavy and not
needed for the first studio iteration.

## Options considered
1. **Typed adapter + MCP tool + tiered install per model; integrate the high-value light + one heavy
   now, defer the rest.** Build **claude-video** (footage vision-analysis, uses our existing 4 tools)
   and **VOID** (object removal, heavy/GPU, weights on first-use) now; document **chandra/voicebox/
   VoxCPM** as roadmap.
2. **Integrate all five now** — large multi-GB downloads, GPU pressure, long; most are unused by the
   first iteration.
3. **Document only** — no capability gain now.

## Decision
Option 1. Each model plugs in via: a typed adapter (`packages/integrations/<name>`), an MCP tool
(agents call tools, never a raw shell), an agent/skill, an Installation-Agent catalog entry for heavy
weights (tier/size/GPU/license, on first-use consent), EDD additions where it produces nodes/assets,
and a cockpit panel. Build claude-video + VOID now; defer chandra, voicebox, VoxCPM.

## Rationale
Maximizes near-term value (footage-aware editing + agency-grade cleanup) without huge downloads;
keeps heavy/GPU work opt-in; preserves the typed-tool security invariant; leaves the architecture ready
for the deferred models (voicebox is already MCP-native).

## Consequences
- Positive: smarter edits + real VFX now; bounded scope; clean extension path.
- Negative: VOID is GPU-only in practice; vision tokens cost scales with frames.
- Mitigations: tiered install + consent for VOID; adaptive frame sampling + caps for claude-video.

## Revisit when
Voiceover/dubbing or document-ingest becomes a priority (enable voicebox/VoxCPM/chandra).
