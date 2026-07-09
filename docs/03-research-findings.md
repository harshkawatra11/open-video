# 03 — Research Findings

> Expands PRD §7. Distilled from the proof-of-concept (root `summary.txt`), the open-design study,
> and the Claude CLI / Agent SDK study.

## A. From the proof-of-concept (`summary.txt`)
The PoC produced a real, finished, agency-grade vertical reel and exposed the engineering realities
the product must absorb.

| # | Finding | Product consequence |
|---|---------|---------------------|
| F1 | The end-to-end pipeline works with off-the-shelf tools (extract→transcribe→detect cuts→smart-cut→tonemap+grade→level→captions/graphics→composite→export). | Productize it; make it reliable, repeatable, conversational (PRD §11). |
| F2 | Installation is the first obstacle (ffmpeg/yt-dlp via winget; Whisper via pip; PATH fix; `PYTHONUTF8=1`). | A tiered Installation Agent with verify/repair/rollback (PRD §10; ADR-0004). |
| F3 | GPU matters enormously for ASR (large-v3 CPU 40+ min vs <1 min on GPU); new Python lacked CUDA torch wheels. | Bundle a pinned Python+torch; device/model is a tiered, user-aware choice (PRD §10.6, §22.2). |
| F4 | small Whisper gave poor word timings; large-v3 gave accurate segment timings + text. | Anchor captions to a capable model's segments; treat the transcript as authoritative (PRD §9, §13.4). |
| F5 | Mechanical Devanagari→Roman fails (schwa: "Aja hama" vs "aaj hum"). | Romanization is a reasoning task done by the Caption agent, preserving timings (PRD §9). |
| F6 | Remotion's native compositor binary crashed on the Windows box; PNG-sequence + FFmpeg shipped the video. | Support both render paths; auto-select via health check (PRD §15.2; ADR-0006). |
| F7 | iPhone HLG looks washed out; zscale tonemap + light grade fixed it. | Tonemap + grade is a first-class, verifiable stage (PRD §15.6). |
| F8 | Two-pass loudnorm to −14 LUFS + gentle denoise is reliable, high-value, fast. | A default one-sentence operation with measured verification (PRD §9 Audio; Appendix B). |
| F9 | "Alive" progress + background jobs are essential UX (users kept asking "done yet?"). | Live terminal + render queue + notifications are core (PRD §14, §19). |
| F10 | Reproducibility requires capturing the plan as data (the PoC wrote a blueprint + formatter). | Formalize the blueprint as the versioned EDD (PRD §12, §13, §17). |

## B. From the open-design study
- F11 — Electron + Next.js + single-privileged-daemon is a proven shape for an agent-native desktop
  creative tool (renderer sandboxed; daemon spawns the agent CLI in isolated project dirs).
- F12 — A "system file" (DESIGN.md) that constrains every output is a powerful, simple primitive →
  OpenVideo's `STYLE.md` (PRD §14).
- F13 — Skills + manifest-described plugins make the system composable without core changes.
- F14 — A stdio MCP server cleanly exposes tools to whichever agent CLI runs.
- F15 — A BYOK proxy with SSRF protection + a sandboxed iframe preview are the right "show generated
  content safely" primitives.

## C. From the Claude CLI / Agent SDK study
- F16 — The CLI runs headless and emits structured events (spawn with stream-json; resume sessions;
  register MCP; define subagents/skills; apply permission modes) — a complete agent backbone.
- F17 — Spawning the CLI runs on the user's subscription auth (cost advantage); the Agent SDK is the
  same engine as a library but typically API-key billed — the documented alternative (ADR-0002).
- F18 — Model + effort are first-class: default `claude-opus-4-8`; `claude-sonnet-4-6` balanced;
  `claude-haiku-4-5` cheap subagents; effort low→max; adaptive thinking. Maps to the control surface
  + agent roster (PRD §9.9, §18.2).
- F19 — Prompt caching, isolated-context subagents, and bounded effort are the cost/latency levers
  (PRD §22.8).

## Net conclusion
The components exist and are proven. OpenVideo's value: remove setup friction, elevate the agentic
workflow to a first-class explainable/reproducible product, and treat editing as compilation over a
typed Video AST. No new core technology required — sound integration of proven technology.
