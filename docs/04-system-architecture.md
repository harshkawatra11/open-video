# 04 — System Architecture

> Expands PRD §8. Four planes; reasoning separated from execution by the typed EDD; only the daemon
> is privileged.

## Planes
- **Presentation (Cockpit):** Electron renderer (Next.js/React), sandboxed (contextIsolation on,
  nodeIntegration off). Speaks only the Edit/Session protocol to the daemon.
- **Control (Daemon):** the single privileged Node 24 process. Session manager, render queue +
  workers, OpenVideo MCP server, tool manager, Installation Agent, workspace/file ops, git
  versioning, BYOK proxy, cache manager, telemetry/diagnostics, crash recovery.
- **Reasoning (Claude CLI):** spawned headless; Director + subagents + skills; calls tools via MCP.
- **Execution (Tools):** FFmpeg/FFprobe, Whisper/faster-whisper, Remotion (headless Chrome), yt-dlp,
  ImageMagick; optional gen/cloud plugins.
- **Data:** the project workspace (EDD git-versioned, assets, transcripts, plans, cache, renders,
  exports, logs, memory).

## Topology decision (Open Question Q1)
The daemon is the Electron main process for v0; **leaning toward a forked/utility service** so a
renderer crash never kills an in-flight render. Decide in Phase 1. Either way, the daemon exposes a
loopback HTTP + SSE interface (bearer-token) to the cockpit.

## Protocols (PRD §8.7)
- **Cockpit ↔ Daemon:** Edit/Session protocol (LSP-inspired). Requests over loopback HTTP; events
  over SSE. Families: `session.* intent.* plan.* edd.* render.* install.* control.* usage.* agent.*`
  (Appendix D §10).
- **Daemon ↔ CLI:** spawn + stdio stream-json via `packages/cli-adapter` (Appendix C).
- **Daemon ↔ Tools:** child processes with typed arg construction, captured output, progress parsing,
  timeouts, cancellation.
- **Daemon ↔ Disk:** project sandbox; content-addressed cache.

## Concurrency model
- Privileged event loop stays responsive; long work goes to worker threads / child processes.
- Render workers: a bounded, resource-aware pool (GPU vs CPU vs Chrome) drains the DAG queue.
- One CLI child per active session; analysis agents fan out in parallel.
- Backpressure caps concurrent renders/transcriptions.

## End-to-end flow (canonical)
intent.submit → ensure deps → spawn/resume CLI → plan (approve) → agents call MCP tools → EDD
patches validated + committed → compile (EDD→IR→DAG) → render (incremental/cached) → preview + QA →
export + version. (PRD §8.9, §11.1.)

## Subsystem registry
See PRD §8.10 for the table mapping every required subsystem (Intent Engine, Planner, Timeline
Generator, Rendering Compiler, Execution Planner, Scene/Motion Graph, Transcript/Caption/Color/Audio
engines, Asset Manager, AI Memory, Version Control, Plugin System, MCP, Tool Manager, Scheduler,
Render Queue, Cache, Error/Crash Recovery, Validation, Telemetry, Diagnostics, Perf Monitoring,
Resource Scheduler, Security, Permissions) to its plane/module and owning doc.

## Tech stack
Electron, Next.js, React, TS (cockpit); Node 24, Express/Fastify + SSE, better-sqlite3, git
(daemon); Claude CLI + MCP (reasoning); FFmpeg/Whisper/Remotion/yt-dlp (execution); pnpm monorepo,
electron-builder (packaging).
