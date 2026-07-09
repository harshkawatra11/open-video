# 25 — External Integrations & Models

> Open-source models/tools integrated as typed adapters + MCP tools + tiered install. Decision:
> ADR-0011. Two are built now (**VOID**, **claude-video**); three are documented roadmap only
> (**chandra**, **voicebox**, **VoxCPM**). All heavy/networked actions are gated MCP tools (CLAUDE.md
> invariant 5); heavy weights install on first-use with consent (ADR-0004). Code in
> `packages/integrations`.

## 1. Capability matrix
```
repo (license)                 capability                     built  agent / MCP tool        install tier
-----------------------------  -----------------------------  -----  ----------------------  -----------
bradautomates/claude-video MIT footage vision-analysis        NOW    Footage-Analysis /      core (uses
                               (frames+transcript → Claude)            analyze_footage          our 4 tools)
netflix/void-model  Apache-2.0 interaction-aware object/       NOW    VFX / vfx_remove_object  heavy (GPU,
                               person/logo removal (cleanup)                                    CogVideoX/SAM)
datalab-to/chandra  Apache/    OCR / document → structured     later  (Ingest agent)           heavy
                    OpenRAIL-M
jamiepine/voicebox  MIT        local voice studio (MCP-native) later  (Voiceover; MCP server)  heavy
OpenBMB/VoxCPM      Apache-2.0 TTS + voice cloning             later  (Voiceover)              heavy (~8GB)
```
(MoneyPrinterTurbo is intentionally not referenced — same niche, different product.)

## 2. claude-video — footage vision-analysis (BUILT NOW; light)
- **Why:** today the planning agents see only transcript + probe metadata. This lets the agent
  actually *watch* the footage → dramatically better hook/pacing/b-roll/cut decisions.
- **Pipeline (reuses our existing tools):** ffmpeg extracts keyframes at an adaptive rate (scene-aware)
  + whisper transcript → frames (as images) + timestamps sent to **Claude vision** → a structured
  **FootageAnalysis**: shot list (type/energy), on-screen text, subjects, dead vs usable ranges,
  suggested hook in-points, b-roll opportunities.
- **Adapter** (`packages/integrations/claude-video`): our own MIT-style implementation — `analyze(
  video, opts) → FootageAnalysis`. Frames go to Claude via the cli-adapter (vision) or a structured
  tool; output is validated JSON cached under the project.
- **MCP tool:** `analyze_footage(projectId|asset) → FootageAnalysis`.
- **Agent:** Footage-Analysis (Vision) agent; the Director runs it in the Analyze stage and feeds the
  result to Planner/Story/Hook/B-roll. **UX:** the Footage panel (doc 23 §10) renders the keyframe
  strip + shot list + energy curve and annotates the timeline.
- **Cost note:** vision tokens scale with frame count — adaptive sampling + a frame cap keep it bounded
  (effort-aware; doc/PRD §22.8).

## 3. VOID — interaction-aware object removal (BUILT NOW; heavy, tiered)
- **Why:** agency-grade cleanup — remove a photobomber, a logo, a boom mic, a distracting object — with
  realistic physics/shadow/reflection cleanup (VOID's interaction-awareness), not a naive patch.
- **Adapter** (`packages/integrations/void`): `removeObject(video, mask|region, prompt, opts) →
  video`. Wraps the VOID inference (CogVideoX + SAM2/3) behind a typed spec; **heavy tier** — weights
  download on first use with consent (Installation Agent catalog entry); **GPU-bound** (CPU path is
  flagged impractical). Apache-2.0.
- **MCP tool:** `vfx_remove_object(projectId, clip, region|mask, prompt)`.
- **Agent:** VFX/Object-removal agent — the Director can delegate ("remove the person at 0:12") or the
  user drives the **VFX panel** (doc 23 §9): region select/track → preview → apply; long-job progress
  in the Render Queue.
- **EDD:** a `vfx` op (kind `remove_object`) on the a-roll, lowered into a pre-grade DAG node so the
  cleaned plate flows through grade→composite→export; content-addressed like any node (incremental).

## 4. Deferred (documented roadmap; NOT wired now)
- **chandra (OCR/doc→structured):** powers a future faceless-explainer/document-ingest path (PDF /
  slides / article / screenshots → narration source). Heavy tier; OpenRAIL-M model license (free under
  the stated revenue cap) — note the license gate in the installer when enabled.
- **voicebox (MCP-native voice studio):** because it speaks MCP already, it later slots in as an MCP
  server the Director can call for TTS/dictation/audio-FX with minimal glue.
- **VoxCPM (TTS + voice cloning, ~8GB VRAM):** future AI narration + dubbing for faceless/AI-narrated
  videos. Heavy tier.
- These are recorded so the architecture stays ready; they are out of scope for the current build.

## 5. Integration architecture (how a model plugs in)
1. A typed **adapter** in `packages/integrations/<name>` with a narrow function surface + unit tests
   at the arg/parse level (heavy inference is integration-gated, like the render executor).
2. An **MCP tool** exposed by the OpenVideo MCP server so agents call it (never a raw shell).
3. An **agent/skill** definition (doc 05) giving the Director a delegate.
4. An **Installation Agent catalog** entry for any heavy weights (tier, size, GPU, license), so it
   downloads on first use with consent + verify/repair/rollback (doc 06, ADR-0004).
5. **EDD** additions where the capability produces a node/asset (so it's reproducible + cached).
6. A **cockpit surface** (a panel) for manual control + the agentic path.

## 6. Licenses & safety summary
VOID Apache-2.0 · claude-video MIT (approach) · chandra Apache(code)/OpenRAIL-M(model) · voicebox MIT ·
VoxCPM Apache-2.0. Heavy models are GPU-bound and opt-in. Generated media follows the copyright-safety
policy (PRD §4.3); no scraped copyrighted media; no non-consensual likeness manipulation (PRD §4.3).
