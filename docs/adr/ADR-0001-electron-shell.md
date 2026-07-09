# ADR-0001: Electron + Next.js desktop shell

- **Status:** Accepted
- **Related:** PRD §8, §18, §30.1; open-design reference

## Context
OpenVideo is a local-first desktop creative tool that must host a rich UI (chat, live terminal,
sandboxed preview), spawn child processes (Claude CLI, ffmpeg, whisper, remotion), and integrate
with the OS (file dialogs, GPU detection, tray, auto-update). The explicit reference, open-design,
is built on Electron + Next.js, and the proof-of-concept ran on Windows with this class of stack.

## Options considered
1. **Electron + Next.js** — mature, huge Node/media ecosystem, 1:1 reuse of open-design patterns,
   PoC-validated on Windows. Con: large binaries (~150 MB) and higher RAM.
2. **Tauri + Rust core** — small/fast binaries, modern. Con: diverges from open-design; fiddlier
   Windows toolchain (WebView2 + MSVC); smaller media ecosystem; more native glue to write.
3. **Web app + local daemon only** — fastest to boot, simplest. Con: weak OS integration
   (dialogs, GPU detect, auto-update, tray); not a "real app".

## Decision
Build on **Electron + Next.js**, with a sandboxed renderer and a privileged Node daemon (see
ADR-0008). Keep a web-from-source dev mode (as open-design has) for contributors.

## Rationale
Maximum reuse of the proven open-design topology and our own Windows PoC validation; the richest
ecosystem for the media/Node work we must do; lowest execution risk for v1. Binary size/RAM is an
acceptable cost for a desktop creative tool.

## Consequences
- Positive: fast path to a working app; ecosystem and examples; matches the reference.
- Negative: heavier footprint than Tauri.
- Mitigations: lazy-load heavy UI; keep the daemon lean; revisit Tauri if footprint becomes a
  hard constraint (see "Revisit when").

## Revisit when
Footprint/perf becomes a top user complaint, or a cross-platform rewrite is on the table and Rust
core consolidation would materially help.
