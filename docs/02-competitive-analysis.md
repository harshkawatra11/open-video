# 02 — Competitive Analysis

> Expands PRD §6. Goal: extract the architectural lesson from each system; do not copy designs.

## Agentic / dev tools
- **Claude Code** — the backbone model. Headless stream-json, sessions, subagents, skills, hooks,
  MCP, plan mode, permission modes, usage meter. *Lesson:* spawn the harness, don't rebuild it
  (ADR-0002).
- **Claude Design / Open Design** — the shell + ecosystem model. Electron + Next.js over a single
  privileged daemon that spawns the agent CLI; a `DESIGN.md` system file; `SKILL.md` skills; a plugin
  marketplace with manifests; stdio MCP server; BYOK proxy with SSRF guards; sandboxed iframe
  preview; pnpm monorepo. *Lesson:* this topology generalizes from design artifacts to video
  artifacts — adopt wholesale, swap the artifact type (ADR-0001, ADR-0008).
- **Cursor / VS Code** — thin keyboard-first shell + extension API + LSP separation. *Lesson:* keep
  the shell thin, intelligence in services; design the plugin API early; the LSP pattern → the
  Edit/Session protocol (PRD §8.7).

## NLEs / motion tools
- **Premiere** — timeline-first; proprietary project. *Lesson:* timeline is the wrong *primary*
  interface for intent, but its vocabulary (tracks/clips/transitions/effects/keyframes) is the right
  EDD vocabulary.
- **DaVinci Resolve** — best-in-class color + Fairlight audio; node-based grading. *Lesson:* color +
  loudness are first-class stages; a node graph is the right render mental model.
- **After Effects** — compositions/layers/keyframes + expressions. *Lesson:* motion graphics are
  programs → Remotion components; agents author components, not hand-keyframed layers.
- **CapCut** — consumer auto-captions/templates, mobile-first. *Lesson:* the output-quality bar for
  captions/templates is high; match it on quality, exceed it on control.

## Programmable media stack
- **Remotion** — React → deterministic frames → MP4. *Lesson:* ideal declarative compile target;
  caveat: native compositor can fail on Windows → PNG-seq fallback (ADR-0006).
- **FFmpeg/FFprobe** — the deterministic execution + inspection core. *Lesson:* wrap behind typed
  tools; never hand the model a raw shell for it.
- **Whisper / faster-whisper / WhisperX** — ASR + timestamps + word alignment. *Lesson:* model size ×
  device is a tiered, user-aware decision; word alignment needs a capable model or a dedicated
  aligner.
- **yt-dlp** — media retrieval. *Lesson:* import is a sandboxed, permissioned capability.

## Generative / orchestration
- **HyperFrames** — HTML/CSS/GSAP → MP4; talking-head caption specialty. *Lesson:* optional renderer
  plugin for a "signature moment"; cut-sensitive → single continuous sub-take.
- **Runway / ElevenLabs** — generative video/voice. *Lesson:* licensing/cost-sensitive → opt-in,
  authorized plugins only.
- **ComfyUI** — node-graph generative pipelines. *Lesson:* validates the execution-graph UX; possible
  power-user graph view.
- **n8n** — workflow automation. *Lesson:* informs the batch/automation engine (roadmap).

## Compiler / language infra (the conceptual core)
- **Git** — content-addressed diffable history. *Lesson:* version the EDD; edits-as-commits;
  rollback/reproducibility for free.
- **MCP** — standard tool/resource surface. *Lesson:* one MCP server for all media tools.
- **LSP** — editor↔intelligence decoupled over a protocol. *Lesson:* the Edit/Session protocol.
- **Tree-sitter / AST / compiler pipelines** — parse→AST→IR→codegen with passes. *Lesson:* editing
  IS compilation (ADR-0005).

See PRD §6.6 for the consolidated take-away table.
