# 19 — Deployment & Release

> Expands PRD §25. Windows-first packaging with a bundled core toolchain; tiered heavy installs;
> signed auto-update; opt-in telemetry; a self-healing doctor.

## Packaging
electron-builder → a Windows installer (first) bundling the cockpit, the daemon, and a **pinned core
toolchain** (ffmpeg/ffprobe, node/pnpm, Remotion runtime) plus the bundled Python+torch toolchain
stub. Heavy items (model weights, CUDA) are fetched by the Installation Agent on the tiered basis
(ADR-0004). macOS/Linux packaging follows (ADR-0007, Phase 9).

## Channels & pinning
stable / beta / nightly; a pinned dependency + tool + CLI version set per release for
reproducibility.

## Auto-update
Background, **signed** app auto-update; the Installation Agent handles tool/model upgrades with
verification + rollback (PRD §10.8).

## Telemetry (opt-in)
Strictly opt-in, privacy-preserving (no media, no project content): crash signals, anonymized perf
metrics, feature usage. Off by default.

## Diagnostics / doctor
A "doctor" command re-profiles hardware, verifies the toolchain, health-checks the Remotion
compositor, and self-heals (reinstall/repair) — turning the PoC's manual debugging into one click.

## Crash reporting & recovery
Local crash logs + opt-in crash reports; journaled state → resume-after-crash for renders; project
integrity preserved (PRD §24.9).

## Release process
Versioned releases + changelogs; schema/protocol/manifest versions + migrations called out; golden-
frame + e2e suites gate releases; `cli-adapter` smoke tests confirm CLI compatibility.
