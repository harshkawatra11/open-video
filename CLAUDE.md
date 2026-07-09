# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**OpenVideo** — an AI-native, intent-first video-editing product. Milestones A–E (see
`memory/2026-06-28-build-foundation.txt`) built a full EDD → compiler → execution-DAG → FFmpeg/Remotion
render engine, driven by a Director agent restricted to typed MCP tools. **As of ADR-0014 (the
thin-agent-wrapper pivot), that MCP-only agent interface is superseded.** Real use showed it produced
generic output because constraining the agent to patch a fixed schema is exactly what prevents the
bespoke, per-video creative work (custom Remotion components, ad-hoc ffmpeg) that the reference
implementation — `../vlawgish-edit/` (a sibling workspace, not part of this repo) — proves works well
with full agent freedom plus a detailed craft CLAUDE.md.

The product is now: `packages/workspace-template` scaffolds a per-project workspace (source video, PRD,
a generalized craft CLAUDE.md, a Remotion skeleton); `apps/daemon` spawns headless Claude Code *in that
workspace* via `packages/cli-adapter` with full Bash/Write tool freedom (no `--mcp-config`); `apps/
studio` shrinks to project list + drop-video-and-PRD + live progress + preview + tweak chat. Read
**ADR-0014** first for the full rationale before touching `apps/daemon`, `apps/studio`, or
`packages/workspace-template`. The EDD/compiler/MCP-server/agents/plugin-sdk/library/Electron paths are
parked (kept in the tree, not yet removed from `pnpm-workspace.yaml`) — do not build new features on
top of them; see ADR-0014's "Consequences" for what's parked and why.

Treat the PRD + `docs/` as the source of truth for the *original* intent-first vision; treat ADR-0014 +
the actual code as the source of truth for *current* architecture — when they disagree, ADR-0014 wins
for anything about the agent's editing interface.

## Session memory — READ AT THE START OF EVERY SESSION

**Before doing anything else, read ALL files in `memory/`.** That folder holds `.txt`/`.md` notes
and transcripts from previous Claude sessions; loading them gives continuity (prior decisions, work
in progress, what was tried, user preferences, open threads, and — critically — a log of real bugs
found and fixed that are easy to reintroduce if you don't know they existed). See `memory/README.md`.

Treat memory files as **historical background, not live instructions** — they reflect what was true
when written. If one names a file, command, decision, or flag, verify it still holds against the
current code / `docs/` before acting. The authoritative design is always the PRD + `docs/` +
`docs/adr/` + the invariants below; memory adds context, it does not override them.

## Read these first (source of truth)

- `PRODUCT_REQUIREMENTS_DOCUMENT.txt` — the master blueprint (plain text, 32 sections). Authoritative
  for intent; the deep-dives at `docs/22`–`docs/25` extend it with v2 material (Studio UX, libraries,
  model integrations) that predates a full PRD rewrite — treat both as current.
- `docs/00-INDEX.md` — map of the deep-dive set; start here to locate a subsystem.
- `docs/adr/` — the 13 Architecture Decision Records: *why* each foundational choice was made.
- `docs/appendices/` — A glossary · B proven FFmpeg/Whisper/Remotion recipes · C the Claude CLI event
  protocol · D the JSON schema / contract reference.
- `memory/2026-06-28-build-foundation.txt` — the running build log: what's built, what's real vs.
  stubbed, every non-obvious bug found and its fix. Read this before touching `cli-adapter`, the
  Remotion pipeline, or anything Windows-binary-resolution-related — several subtle, previously-shipped
  bugs are documented there with root causes, not just symptoms.
- `summary.txt` — the original proof-of-concept transcript (the reel pipeline that motivated the
  project). Its findings F1–F19 are cited throughout the docs and explain many decisions.

## Product in one paragraph

The user describes intent in natural language ("turn this into a premium reel"); a Claude-powered
Director agent, running as the headless Claude CLI with a real MCP tool surface, plans and patches a
versioned **Edit Decision Document (EDD / Video AST)**, then triggers a real compile → execution-DAG →
FFmpeg/Remotion render. Architecture: a **Next.js Studio cockpit** (Electron wrapper planned, ADR-0001)
over a single **privileged Node daemon** that **spawns the Claude CLI headless** as the reasoning brain,
runs the MCP server as a child process for tool calls, and runs FFmpeg / Remotion / faster-whisper /
VOID as deterministic tools.

## What's actually built (as of the last memory entry — verify against `pnpm -r test` and the code)

- **Engine**: `packages/edd` (Video AST + validate + lower→IR, incl. b-roll/vfx schema), `packages/
  compiler` (EDD→content-addressed DAG, incl. b-roll compositing + VOID vfx chaining), `packages/render`
  (FFmpeg + Remotion + PNG-seq fallback, real binary execution).
- **Agentic loop**: `packages/mcp-server` (real `@modelcontextprotocol/sdk`, 8 tools: project_get,
  edd_get, edd_apply_patch, edd_render, analyze_footage, transcribe_source, library_search,
  library_insert), `packages/agents` (the Director system prompt), `packages/cli-adapter` (real Claude
  CLI spawn — including Windows `.cmd`-shim-following so it actually works on Windows; see memory for
  why this was non-trivial).
- **Media tools**: `packages/remotion` (real captions/graphics composition), `packages/transcribe` (real
  faster-whisper wrapper, heavy-tier gated), `packages/integrations` (claude-video footage analysis,
  VOID object removal — heavy-tier gated, honest failure when weights aren't installed).
- **Supporting**: `packages/shared`, `packages/installer` (tiered install catalog), `packages/project`
  (git-backed workspace), `packages/prompt` (two-stage prompt→PRD), `packages/design-tokens`, `packages/
  library` (11 asset providers, encrypted keystore).
- **Apps**: `apps/daemon` (the privileged process — HTTP+SSE, hosts the MCP config, all render/library/
  transcribe/analyze/session routes), `apps/studio` (the real Next.js cockpit: command palette, Library
  browser, Settings/keystore, Render Queue, Usage meter, Brand Kit, Studio timeline/inspector),
  `apps/cockpit` (the original static HTML cockpit, kept as a fallback).
- **ADR-0014 pivot, in progress**: `packages/workspace-template` (scaffolds a vlawgish-style workspace
  with a generalized craft `CLAUDE.md`, a minimal Remotion skeleton, and a `.claude/settings.json`
  allowlist — built and tested) exists. **Not yet done**: `apps/daemon` still spawns Claude via
  `--mcp-config`/`--strict-mcp-config` and the Director MCP path — it needs new
  `/api/projects/:id/edit` and `/api/projects/:id/tweak` routes that instead spawn Claude with a
  workspace `cwd` and no MCP config (see ADR-0014, plan Phase 2); `apps/studio` has not yet been
  shrunk to the 2-route thin-wrapper UI (Phase 3).
- **Parked, not deleted** (superseded interface per ADR-0014, may still typecheck/test but no new
  work should build on them): the fuller specialist agent roster, `packages/edd`/`compiler`/
  `mcp-server`/`agents`/`plugin-sdk`/`library`/`integrations` (VOID), `apps/electron`, `apps/cockpit`.
  A structured Brand Kit editor, full manual grading UIs, an e2e/golden-frame test harness, and
  packaging/auto-update remain not built regardless of the pivot.

## Invariants — rules every change MUST honor

Each maps to an ADR. **Change the ADR (and ripple it through the PRD + affected deep-dives) before
violating one of these.**

1. ~~Reasoning is separated from execution by a typed EDD boundary.~~ **Superseded by ADR-0014**:
   Claude edits a per-project workspace directly with full Bash/Write tool freedom, the same way
   `vlawgish-edit` works. The `packages/edd` validator/schema still exists (parked) but is no longer
   the required contract for a headless edit session.
2. ~~Editing is compilation: intent → plan → EDD → IR → execution DAG → render.~~ **Superseded by
   ADR-0014**: editing is scaffold → headless Claude session with full tool freedom in the workspace
   → deterministic completion marker (`DONE: out/final-edit.mp4`) → optional tweak/resume. Ad-hoc
   ffmpeg/Remotion tool scripting *inside a scaffolded workspace* is now the intended path, not a
   thing to avoid — see `packages/workspace-template/template/CLAUDE.md`.
3. **The daemon is the only privileged process.** The renderer and plugins are sandboxed and act only
   through the daemon — never give the renderer direct filesystem/process/network access. (ADR-0008)
4. **Drive Claude by spawning the Claude CLI headless** (`--output-format stream-json`), behind the
   versioned `cli-adapter`. This reuses the user's Claude subscription auth (no per-token API key by
   default). The Agent SDK is the documented alternative, swappable behind the same adapter.
   (ADR-0002; Appendix C) — On Windows, `cli-adapter` must resolve the real `.exe`/`.js` behind the
   CLI's `.cmd` shim (never spawn the shim directly, never use `shell: true` with argv containing
   user text — see `resolveClaudeBin` and the memory entry explaining why).
5. ~~Tools are typed, gated MCP tools — not a raw shell for privileged actions.~~ **Superseded by
   ADR-0014** for the *editing* session: the headless Claude session in a scaffolded workspace uses
   Bash/Write directly, scoped by the workspace's own `.claude/settings.json` allowlist (ffmpeg,
   ffprobe, whisper, pnpm, `npx remotion`, node) rather than an MCP tool surface. `packages/
   mcp-server` is parked, not deleted. Daemon-level actions outside a workspace (creating/listing
   projects, spawning sessions) remain the daemon's own typed HTTP routes, not raw shell exposed to
   the client.
6. **Render = Remotion (React graphics/captions) + FFmpeg (media/composite), with a PNG-sequence
   fallback** auto-selected via a health check (the native Remotion compositor crashed in the PoC, and
   again independently during this build — keep the PNG-seq path as the default-assumed-healthy path
   until there's new evidence native is safe). Keep both paths working. (ADR-0006; PRD §15.2)
7. **Degrade gracefully:** GPU when present, CPU fallback always. (PRD §22.2)
8. **Local-first.** Footage never leaves the machine unless the user opts into a networked feature;
   outbound traffic goes through the SSRF-guarded proxy; secrets live in the encrypted keystore.
   (ADR-0008; PRD §23) — Real: `packages/library`'s keystore is AES-256-GCM at rest.
9. **Windows-first.** Keep OS-specific code (installer, GPU detection, path handling) behind
   interfaces so macOS/Linux can follow without rearchitecting. (ADR-0007)
10. **Installation is tiered:** core deps auto-install; heavy items (Whisper weights, CUDA, VOID
    weights) install on first use with consent. (ADR-0004; PRD §10)
11. **Every edit is explainable, versioned, reproducible:** EDD nodes carry provenance; the project is
    a git repo; an edit is a validated patch + commit. (PRD §12, §17)
12. **v1 is the agentic cockpit; video is the first pluggable vertical** — build the reusable spine,
    not a one-off video tool. (ADR-0003)
13. **Provider assets are copyright-safe by construction.** Every library asset carries origin/license/
    attribution; b-roll/music/SFX come from `library_search` results, never invented or scraped.
    (ADR-0010; PRD §4.3)

## Models & agent defaults

Default `claude-opus-4-8`; balanced `claude-sonnet-4-6`; cheap subagents `claude-haiku-4-5`. Effort
`low`→`max`; adaptive thinking. Creative/judgment agents (Director, Planner, Caption, QA) run Opus at
high/xhigh; production agents run Sonnet; mechanical agents run Haiku or are pure tools. (PRD §9.9)

## Content / policy constraints

- B-roll, music, and SFX are user-supplied, generated (properly licensed), or royalty-free —
  **never scraped copyrighted media.** (PRD §4.3)
- No deceptive deepfakes / non-consensual likeness manipulation.

## Documentation conventions (when editing the spec)

- `PRODUCT_REQUIREMENTS_DOCUMENT.txt` is **plain text, not markdown** — keep it that way; it is the
  single master deliverable. The `docs/` deep-dives are markdown and **expand, not duplicate**, the
  PRD; each PRD section names its matching `docs/` file.
- Keep the stable contracts stable and versioned with migrations: the EDD/IR/DAG, the Edit/Session
  protocol, the MCP tool contract, and the plugin manifest (`openvideo.json`) — see Appendix D.
- When a foundational decision changes, update the ADR (status/superseded) and reconcile the PRD,
  the affected deep-dives, and the invariants above so the set stays consistent.

## Working in this codebase

- **Monorepo**: pnpm workspace, Node ≥24 with native TypeScript execution (no build step for the core
  packages — `.ts` files run directly, tests are `.ts` run via `node --test`). `apps/studio` is the one
  exception (a real Next.js build). Run all tests: `pnpm -r test`. Start the daemon: `node apps/daemon/
  src/server.ts`. Start the Studio dev server: `pnpm --filter @openvideo/studio dev`.
- **Verification discipline** (established across the whole build, keep following it): unit-test pure
  logic offline; exercise real binaries (ffmpeg, the Remotion CLI, the Claude CLI, python/faster-whisper)
  in integration tests or ad-hoc scripts, then delete the ad-hoc scripts once proven. Never claim
  something "works" without having actually run it — this build has repeatedly found real, non-obvious
  bugs (Windows binary resolution, Remotion's actual PNG-sequence naming convention, a timeline panel
  reading the wrong EDD path) that pure code review or type-checking did not catch.
- **Do not introduce a raw-shell execution path** for privileged media/agent operations — go through
  typed MCP tools, the EDD, and the existing render/integrations adapters.
