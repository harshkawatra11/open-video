# 05 — Agent Architecture

> Expands PRD §9. Director + specialists, realized on the Claude CLI as subagents + skills + MCP
> tools.

## Realization on the Claude CLI
- The **Director** is the top-level CLI session, seeded by the daemon with the system prompt, the
  project `STYLE.md`, the current EDD, and the MCP tool list.
- **Subagents** are Claude Code subagent definitions shipped in the scaffold (`packages/agents` +
  project `agents/`). The Director delegates to them; isolated context per subagent.
- **Skills** (`SKILL.md`) encode task playbooks loaded on demand ("premium reel captions", "HLG→SDR
  grade recipe").
- **Tools** = the OpenVideo MCP server (PRD §8.6). High-risk actions are dedicated, gated tools.
- **Loop:** plan → approve → execute → review → refine (PRD §16).

## Roster & default models (PRD §9.3)
Director (opus, xhigh) · Planner (opus, high) · Research (sonnet) · Transcript (haiku/tool + opus) ·
Audio (sonnet) · Color (sonnet) · Story/Retention/Hook (opus, high) · Caption (opus, high) ·
Motion/Animation (sonnet) · B-roll (sonnet) · Music/SFX (sonnet) · Thumbnail/Title/Meta (sonnet) ·
QA/Critique (opus, high) · Simulation (sonnet) · Validation (haiku/tool) · Optimization/Perf
(sonnet) · Export (haiku/tool + check) · Installation (sonnet).

## Per-agent specs
The full template (Remit | Inputs | Outputs | Memory | Tools | Permissions | Comms | Failure/Retry |
Delegation | Context strategy | Reasoning/effort) for every agent is in **PRD §9.4**. Highlights:
- **Director** — owns the goal; parallelizes independent analysis; bounded autonomy; integrates +
  accepts.
- **Caption** — word-level karaoke, emphasis, romanization-as-reasoning, sync ≤ 80 ms, off-eyeline.
- **Color** — detect HDR/HLG; tonemap + tasteful grade; verify before/after; avoid over-grade.
- **Audio** — voice chain + −14 LUFS + ducking + SFX; verify measured loudness.
- **QA/Critique** — independent context; scores vs rubric; demands specific revisions; gates accept.
- **Motion** — Remotion components; render-path fallback handled by the engine, not the agent.
- **B-roll / Music** — copyright-safe only (generated/licensed/royalty-free); never scrape.
- **Installation** — the one elevated-privilege agent; explicit, audited (PRD §10).

## Inter-agent comms
Shared substrate = the EDD (validated patches) + typed control messages routed by the Director
(hub-and-spoke with parallel fan-out). No free-text agent-to-agent. All artifacts written to the
workspace (inspectable, versioned).

## Memory
Session (CLI transcript, compacted) · Project (`memory/*.md`: style decisions, prior critiques,
preferences) · Artifact (versioned EDD/plan/transcript/renders).

## Failure / retry / escalation
Tool failure → classify (transient/fallback/fatal). Low-quality output → QA loop (budgeted) →
escalate to user on exhaustion. Missing capability → Installation Agent or ask. Never loop
unboundedly (effort/turn budget).

## Context-window strategy
Subagents get only their slice + STYLE.md + inputs; large artifacts referenced by path/summary;
long sessions rely on compaction; stable context ordered first for prompt caching (PRD §22.8).
