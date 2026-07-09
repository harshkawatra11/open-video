# 20 — Roadmap

> Expands PRD §26. Phased, exit-criteria-driven.

| Phase | Theme | Delivers | Exit criteria | Status |
|-------|-------|----------|---------------|--------|
| 0 | Research | PoC + this PRD; validate pipeline + CLI backbone | This document approved | ✅ Done |
| 1 | Architecture & scaffolding | Monorepo; Edit/Session protocol; EDD schema + validation; cli-adapter; MCP server skeleton; Installation Agent (core tier); cockpit shell (chat + live terminal + control surface + usage meter) | Fresh Windows box installs core deps + holds a live Claude session in the cockpit | ✅ Done |
| 2 | Prototype (cockpit + first vertical) | Compiler (EDD→IR→DAG); render engine (FFmpeg + Remotion + PNG-seq fallback); analysis tools; the reel pipeline as flagship plugin | "Make a reel" works end-to-end on the PoC clip, reproducibly, with preview + export | ✅ Engine/agentic loop done; flagship-plugin packaging still open (Milestone E) |
| 3 | Alpha | Full agent roster + QA loop; plan-mode UX; EDD inspector/diff; incremental cache; tiered heavy-install (Whisper/CUDA); STYLE.md look system; basic plugin loading | A non-technical user completes UC1–UC10 with no manual tooling | 🟡 Shippable-Alpha feature set done (single Director, not the full roster); plugin loading + UC1–UC10 walkthrough still open |
| 4 | Beta | Plugin SDK + marketplace; more caption styles/transitions/templates; hardened GPU paths; perf/regression suite; crash recovery; doctor; opt-in telemetry | External plugin authors ship; stability metrics meet bar | ⬜ Not started |
| 5 | Production 1.0 | Windows GA; signed auto-update; full docs; golden/e2e gates; accessibility complete | 1.0 release | ⬜ Not started |
| 6 | Plugin SDK maturity | Stable versioned APIs; richer renderers (HyperFrames signature moment); look-system marketplace; format templates | Ecosystem relies on stable APIs |
| 7 | Cloud rendering (opt-in) | Offload heavy final renders via the content-addressed DAG; local cache authoritative | Remote render parity + privacy preserved |
| 8 | Collaboration | Shared projects, comments, review/approval; multi-user EDD editing (CRDT/merge on the AST) | Two users co-edit safely |
| 9 | Cross-platform | macOS (Metal/VideoToolbox) + Linux (VAAPI) builds | Feature parity on macOS/Linux |
| 10 | Long-form & advanced | Multi-hour/multi-track scale; advanced color/audio; generative media (authorized plugins); automation/workflow engine (n8n-style) | Long-form projects perform acceptably |
| 11 | Enterprise | SSO, audit, policy controls, team libraries, on-prem render | Enterprise pilot |
| 12 | Mobile | Companion/mobile client (capture, review, light edits) | Mobile beta |

## Long-term vision
The open, agent-native creative OS for video: any creator, any platform, conversation-driven,
reproducible, extensible, local-first — "Open Design for video."
