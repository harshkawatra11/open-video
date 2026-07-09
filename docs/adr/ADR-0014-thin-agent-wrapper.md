# ADR-0014: Thin agent wrapper — supersede the EDD/IR/DAG as the agent's required interface

- **Status:** Accepted
- **Supersedes:** ADR-0005 (as the *agent's* required interface — the EDD/compiler/render packages
  are parked, not deleted, in case a typed interchange format is needed again later)
- **Related:** PRD §11–§15, §30.3; `vlawgish-edit/CLAUDE.md` (the working reference implementation
  this ADR generalizes)

## Context

Milestones A–E built the full EDD → IR → execution-DAG → render pipeline described in ADR-0005, with
a Director agent that edits *only* through 6–8 typed MCP tools patching a validated EDD. It works —
60+ tests pass, the compiler and renderer are real. But real end-to-end use produced generic,
templated output and an incomplete, hard-to-finish pipeline, while a separate, unproductized
workspace (`vlawgish-edit/`) — where Claude Code has full Bash/Write freedom, a single detailed
CLAUDE.md, and no typed schema to patch — produces premium, bespoke edited reels in ~15 minutes per
video. The gap is architectural, not a code-quality problem: constraining the agent to fill in a
fixed AST is exactly what makes the output feel generic, because the agent can no longer write a
bespoke React graphic component or an ad-hoc ffmpeg filter chain for what a specific video actually
needs.

## Options considered

1. **Keep the EDD as the only agent interface, invest in richer tools** — add more MCP tools, an
   "escape hatch" custom-component tool, more specialist agents. Con: still bottlenecks all
   creativity through whatever the schema anticipated; the schema will always lag what an unbounded
   creative task needs; this is the path already tried for multiple milestones without closing the
   quality gap.
2. **Thin agent wrapper** — the product becomes a scaffolder + orchestrator around the
   `vlawgish-edit` workflow: create a per-project workspace (source video, PRD, a generalized craft
   CLAUDE.md, a minimal Remotion skeleton), spawn headless Claude Code *in that workspace* with full
   tool freedom (no `--mcp-config`, no fixed schema), and stream its own Bash/Write tool-call
   activity to the UI as progress. The generalized CLAUDE.md — not the EDD — becomes the load-bearing
   artifact carrying craft knowledge (the PNG-sequence render workaround, loudness targets, the
   caption-margin bug, QA discipline) forward between edits.
3. **Abandon productization, keep using vlawgish-edit directly** — zero engineering cost, but doesn't
   solve the actual goal (something usable by people who don't already know this toolchain).

## Decision

Adopt **Option 2**. `packages/workspace-template` scaffolds the workspace and owns the generalized
CLAUDE.md template; `apps/daemon` spawns Claude via the existing `packages/cli-adapter` with a
workspace `cwd` and no MCP config; `apps/studio` shrinks to project list + drop-video-and-PRD +
live progress feed + preview + tweak chat.

## Rationale

The working system already exists — vlawgish-edit — and works precisely because of full agent
freedom plus accumulated craft knowledge in a document, not because of a compiler. Productizing it
means packaging *that* pattern (scaffold + craft doc + freedom + memory loop), not replacing it with
a schema the agent must be constrained to. `packages/cli-adapter`'s spawn interface already supports
everything this needs (`cwd`, `resume`, `permissionMode`) — the pivot is mostly deletion of the
MCP-only path plus one new template package, not a rewrite.

## Consequences

- Positive: output quality has a direct path to matching the proven reference implementation; the
  platform surface shrinks dramatically (no plugin sandboxing, no 11-provider library, no Electron
  shell needed for a useful v1); the CLAUDE.md template is the actual differentiated product asset
  and gets better with every edit via the memory/learnings loop.
- Negative: loses the EDD's explainability/reproducibility/versioned-patch properties (ADR-0005's
  stated goals) — an edit is no longer a diffable, replayable structured patch, it's a Claude Code
  session's worth of Bash/Write history in a git-tracked workspace.
- Mitigations: the workspace itself is still a git repo per vlawgish-edit's existing pattern, so
  history is preserved at the file/commit level even without a typed AST diff; the completion marker
  (`DONE: out/final-edit.mp4`) and `memory/learnings.txt` give the orchestrator and the next session
  enough structure to resume/tweak without the EDD.
- `packages/edd`, `compiler`, `mcp-server`, `agents`, `plugin-sdk`, `library`, `integrations` (VOID),
  `apps/electron`, `apps/cockpit` are parked (kept in the tree, dropped from `pnpm-workspace.yaml`
  once the thin-slice is proven) rather than deleted outright, in case a typed interchange format is
  needed again for a future collaborative/multi-agent editing mode.

## Revisit when

If the product later needs multiple specialist agents collaborating on one edit, or a
replayable/diffable edit history becomes a hard requirement (e.g. for undo/redo across a team) — at
that point a typed intermediate representation may be worth reintroducing, informed by what the
thin-wrapper version actually needed.
