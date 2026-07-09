# OpenVideo — Architecture & Design Documentation Index

> **OpenVideo** is a local-first, open-source, **AI-native, intent-first programmable video-editing
> operating system**. The user never hand-edits a timeline; they describe intent in natural language,
> and a Claude-powered multi-agent system plans, compiles, and renders the result. Every edit is
> represented as structured, versioned, inspectable data (the **Edit Decision Document / Video AST**)
> *before* it renders.

This folder holds the deep-dive architecture documents that expand the master blueprint. The single
authoritative top-level deliverable is **`../PRODUCT_REQUIREMENTS_DOCUMENT.txt`** (plain text). Each
section of that PRD points to the matching document here.

> **Implementation status:** a working shippable-Alpha implementation exists (Milestones A–E: the
> agentic loop, real render engine incl. captions/b-roll/VFX, a Next.js Studio cockpit, and initial
> hardening). See `../CLAUDE.md` for what's built vs. deferred and `../memory/
> 2026-06-28-build-foundation.txt` for the full build log. This doc set remains the design intent —
> where the code and the docs disagree, treat it as a bug in whichever one is wrong, not as the docs
> being stale by default.

---

## How to read this set

1. **Start with the PRD** (`../PRODUCT_REQUIREMENTS_DOCUMENT.txt`) — the complete, self-contained
   blueprint. Read it end to end.
2. **Then drill into deep-dives** below for any subsystem you will implement.
3. **Consult the ADRs** (`adr/`) for *why* each foundational decision was made (context, options,
   trade-offs, decision, consequences).
4. **Use the appendices** (`appendices/`) as implementation references (glossary, ffmpeg recipes,
   the Claude CLI event protocol, the JSON schema reference).

---

## Locked foundational decisions (see `adr/` for full records)

| # | Decision | Summary |
|---|----------|---------|
| ADR-0001 | Desktop shell | **Electron + Next.js** (mirrors open-design; VS Code / Cursor lineage) |
| ADR-0002 | Agent backbone | **Spawn the Claude CLI headless** (stream-json); reuses the user's Claude Pro subscription auth |
| ADR-0003 | v1 north star | **Agentic cockpit first**; video ships as the first pluggable vertical |
| ADR-0004 | Installation | **Tiered**: core auto-installs silently; heavy items (weights/CUDA) on first use |
| ADR-0005 | Edit representation | **Video AST / Edit Decision Document (EDD)** + typed IR; compiler → execution DAG |
| ADR-0006 | Render path | **Remotion (React graphics) + FFmpeg composite**; PNG-sequence overlay fallback proven in the PoC |
| ADR-0007 | Platform priority | **Windows-first**; macOS/Linux on the roadmap |
| ADR-0008 | Privacy | **Local-first**; daemon is the sole privileged process; BYOK proxy with SSRF guard |
| ADR-0009 | Cockpit stack | **Next.js + Tailwind + shadcn/ui** studio UI (`apps/cockpit`) over the daemon |
| ADR-0010 | Libraries | Typed **provider registry**; keyless now, key-gated wired-inactive; copyright-safe |
| ADR-0011 | Model integrations | Tiered **MCP adapters**: VOID + claude-video now; chandra/voicebox/VoxCPM deferred |
| ADR-0012 | Design system | **Jet-black "Obsidian"** app design system + Google Fonts (Font Studio) |
| ADR-0013 | Prompt engine | **Two-stage prompt→PRD** (Opus low-effort + template) drives the agent |

Default model: `claude-opus-4-8`. Balanced: `claude-sonnet-4-6`. Cheap subagents: `claude-haiku-4-5`.
Effort `low → max`; adaptive thinking.

---

## Document map

### Product & research
- [01-vision-and-product.md](01-vision-and-product.md) — vision, goals, non-goals, personas, principles
- [02-competitive-analysis.md](02-competitive-analysis.md) — lessons extracted from ~25 reference systems
- [03-research-findings.md](03-research-findings.md) — architectural lessons + proof-of-concept findings

### Core architecture
- [04-system-architecture.md](04-system-architecture.md) — cockpit · daemon · agent · engine; IPC, SSE, data flow
- [05-agent-architecture.md](05-agent-architecture.md) — Director + every specialized subagent (full specs)
- [06-installation-agent.md](06-installation-agent.md) — tiered install, HW detection, repair/rollback
- [07-video-engine-and-compiler.md](07-video-engine-and-compiler.md) — Video AST/EDD, IR, compiler passes
- [08-execution-and-render-graph.md](08-execution-and-render-graph.md) — DAG, scheduling, incremental, caching
- [09-rendering-engine.md](09-rendering-engine.md) — Remotion + FFmpeg, GPU/CPU, proxies, HDR/SDR, codecs
- [10-data-models.md](10-data-models.md) — JSON schemas: project, EDD, transcript, plan, style, cache
- [11-prompt-and-intent-engine.md](11-prompt-and-intent-engine.md) — intent taxonomy, prompts, CLI event protocol, memory

### Experience & extensibility
- [12-workspace-and-file-structure.md](12-workspace-and-file-structure.md) — directory tree + versioning model
- [13-ux-and-terminal.md](13-ux-and-terminal.md) — cockpit UX + the "alive" terminal + the end-to-end script
- [14-style-and-design-system.md](14-style-and-design-system.md) — STYLE.md look/brand system + design tokens
- [15-plugin-sdk.md](15-plugin-sdk.md) — openvideo.json manifest, plugin types, lifecycle, sandbox

### Operations
- [16-performance.md](16-performance.md) — GPU accel, background/distributed render, cache, large projects
- [17-security.md](17-security.md) — privilege model, sandboxing, permissions, secrets, SSRF
- [18-testing-and-qa.md](18-testing-and-qa.md) — unit/integration/e2e, golden frames, agent eval harness
- [19-deployment-and-release.md](19-deployment-and-release.md) — packaging, auto-update, channels, telemetry
- [20-roadmap.md](20-roadmap.md) — research → … → enterprise → mobile
- [21-risks-and-open-questions.md](21-risks-and-open-questions.md) — engineering risks + open questions

### Studio UI, libraries & integrations (v2 — the production studio)
- [22-design-system-and-brand.md](22-design-system-and-brand.md) — jet-black "Obsidian" app design system + brand + Google Fonts
- [23-cockpit-screens.md](23-cockpit-screens.md) — screen-by-screen Studio UX; two-mode (Auto/Operator); command palette
- [24-asset-libraries-and-providers.md](24-asset-libraries-and-providers.md) — fonts/b-roll/music/SFX/images provider registry + Library browser
- [25-integrations-and-models.md](25-integrations-and-models.md) — VOID + claude-video (now); chandra/voicebox/VoxCPM (roadmap)

### Decision records & appendices
- `adr/` — ADR-0001 … ADR-0013 + `_TEMPLATE.md`
- `appendices/` — A glossary · B ffmpeg recipes · C Claude CLI event protocol · D data-schema reference

---

_Status: living documents. The PRD is the source of truth; deep-dives expand it; ADRs justify it._
