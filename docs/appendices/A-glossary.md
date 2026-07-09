# Appendix A — Glossary

| Term | Definition |
|------|------------|
| **OpenVideo** | The product: a local-first, AI-native, intent-first programmable video-editing OS. |
| **Cockpit** | The Electron + Next.js desktop UI (chat, live terminal, control surface, preview). |
| **Daemon** | The single privileged Node process; the only component that touches fs/processes/network. |
| **The CLI** | The Claude Code command-line tool, spawned headless as OpenVideo's reasoning backbone. |
| **cli-adapter** | The versioned package that spawns the CLI and parses its stream-json events. |
| **EDD (Edit Decision Document)** | The Video AST: a typed, JSON, git-versioned, intent-bearing description of an edit. The contract between agents and the engine. |
| **Video AST** | Synonym for the EDD — the abstract syntax tree of an edit. |
| **IR (Intermediate Representation)** | The normalized, concrete, resolution-independent form the EDD is lowered into before passes. |
| **Lowering** | The compiler step that turns the intent-level EDD into the concrete IR (resolving style tokens, expanding directives, resolving assets/time bases). |
| **Pass** | A compiler stage over the IR: validation, lint, optimization, scheduling. |
| **Execution DAG** | The directed acyclic graph of content-addressed tool invocations the scheduler runs. |
| **Node (DAG)** | One typed tool call with resolved inputs/params and a deterministic cache key. |
| **Content-addressed cache** | A cache keyed by hash(op + inputs + params + tool versions); unchanged nodes are reused. |
| **Incremental render** | Re-rendering only the DAG subtree affected by an EDD change. |
| **Proxy** | A low-resolution copy of a source used for fast preview/QA. |
| **Golden frame** | A committed reference frame/output used to detect render regressions. |
| **Director** | The orchestrating agent that owns the goal, plans, delegates, and accepts the result. |
| **Subagent** | A specialized agent (Planner, Caption, Color, QA, etc.) with a narrow remit. |
| **MCP (Model Context Protocol)** | The standard tool/resource surface; OpenVideo exposes media tools via one MCP server. |
| **STYLE.md** | The per-project look/brand "system" file that constrains every output (open-design DESIGN.md analog). |
| **Look system** | A reusable STYLE.md pack ("MagnatesMedia-style", a brand kit). |
| **Plan mode** | Propose-a-blueprint-then-await-approval mode (vs auto mode = bounded autonomy). |
| **Permission mode** | The policy governing which hard-to-reverse actions are gated for user approval. |
| **Smart-cut** | Trimming dead air/silence/hesitation to tighten pacing while preserving natural speech. |
| **Punch-in ("breathe")** | A subtle alternating zoom per cut segment (e.g. 1.00↔1.03) so jump cuts feel intentional. |
| **Tonemap** | Mapping HDR/HLG footage into an SDR (Rec.709) color space. |
| **LUFS** | Loudness Units Full Scale — the loudness standard (e.g. −14 LUFS for social). |
| **dBTP** | Decibels True Peak — peak loudness measure (e.g. ≤ −1.0 dBTP to avoid clipping). |
| **loudnorm** | FFmpeg's two-pass loudness normalization filter. |
| **afftdn** | FFmpeg's FFT-based denoise filter. |
| **zscale** | FFmpeg's zimg-based scaling/colorspace filter (used for tonemapping). |
| **NVENC** | NVIDIA's hardware video encoder (h264_nvenc / hevc_nvenc). |
| **CUDA** | NVIDIA's GPU compute platform (accelerates ASR/encode). |
| **Whisper / faster-whisper / WhisperX** | Speech-to-text models/tools; WhisperX adds word-level alignment. |
| **Hinglish** | Romanized Hindi mixed with English; produced by reasoning, not mechanical transliteration. |
| **Remotion** | React → deterministic frames → MP4; OpenVideo's graphics/caption engine. |
| **PNG-sequence fallback** | Rendering Remotion graphics as transparent PNGs via headless Chrome, then compositing with FFmpeg (used when the native compositor is unhealthy). |
| **HyperFrames** | HTML/CSS/GSAP → MP4 engine; an optional renderer plugin. |
| **Installation Agent** | The tiered, hardware-aware component that provisions the toolchain. |
| **Edit/Session Protocol** | The documented cockpit↔daemon request/event protocol (LSP-inspired). |
| **Provenance** | The record on each EDD node of which agent authored it and why. |
| **BYOK proxy** | "Bring your own key" outbound proxy for optional provider plugins; SSRF-guarded. |
| **SSRF** | Server-Side Request Forgery — the class of attack the proxy guards against. |
