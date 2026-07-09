# 21 — Risks & Open Questions

> Expands PRD §27–§28.

## Engineering risks
| ID | Risk | Impact | Likely | Mitigation |
|----|------|--------|--------|------------|
| R1 | Claude CLI flags/event schema drift | High | Med | Versioned `cli-adapter`; Appendix C contract; pin CLI version; smoke tests |
| R2 | Native toolchain fragility (Windows) | High | High | Installation Agent verify/repair/rollback; bundled pinned toolchain |
| R3 | Remotion native compositor failure | Med | Med | Auto PNG-seq + FFmpeg fallback (ADR-0006); health check + doctor |
| R4 | Agent reliability / quality variance | High | Med | Structured EDD + validation gates; QA/critique loop; eval harness; bounded autonomy |
| R5 | Cost/latency of agentic sessions | Med | Med | Prompt caching; cheap subagents; effort/turn budgets; usage meter |
| R6 | ASR speed on CPU | Med | High | Tiered GPU enablement; faster-whisper; clear trade-off (PoC F3) |
| R7 | Determinism gaps (encoders) | Med | Med | Pin encoders/settings; tolerance-based golden tests |
| R8 | Scope creep (NLE depth, generative) | High | Med | Cockpit-first; strict non-goals; phased roadmap |
| R9 | Plugin security | High | Low | Sandbox + capability/permission model; signed registry; SSRF-guarded proxy |
| R10 | Prompt-injection via media/metadata | Med | Med | Typed gated tools (no raw shell for privileged acts); permission gates; untrusted-input posture |
| R11 | Auth coupling to Claude subscription | Med | Low | Document Agent-SDK/API-key alternative (ADR-0002); adapter isolates auth |
| R12 | Large-project memory/perf | Med | Med | Streaming, proxies, spill-to-disk; long-form is a later phase |

## Open questions (decision owners + when)
- **Q1** Daemon topology: Electron main vs forked service — Phase 1 (leaning forked service).
- **Q2** EDD time model: seconds vs frame-exact rationals at the EDD level (IR is frame-exact
  regardless) — Phase 1.
- **Q3** Caption word-timing: distribute-within-segment vs WhisperX aligner as default — benchmark
  Phase 2.
- **Q4** STYLE derivation: how far to push "make it feel like X" style transfer vs explicit tokens —
  Phase 3.
- **Q5** Cache scope: per-project only vs shared global default — measure hit rates.
- **Q6** Plugin isolation: worker threads vs heavier VM for untrusted code — before marketplace
  (Phase 4).
- **Q7** Usage/limit fidelity: exactly what the CLI exposes vs estimation — validate vs live events.
- **Q8** Generative media policy: which providers (if any) ship first-party vs community-only.
- **Q9** HDR delivery: when to support HDR export vs SDR-only default.
- **Q10** Multi-user EDD merge: CRDT vs operational transform — defer to Phase 8; keep the EDD
  merge-friendly now.
