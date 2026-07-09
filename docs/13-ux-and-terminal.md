# 13 — UX & Terminal

> Expands PRD §18–§19. A calm, premium, keyboard-first cockpit with an "alive" terminal.

## Cockpit layout
```
+----------------+-----------------------------------+------------------+
| Projects/Assets|  Conversation (chat)              |  Preview         |
| (left rail)    |  intent + agent replies           |  (sandboxed      |
|                |  plan proposals (approve/amend)   |   iframe)        |
|                |  inline permission approvals      |  + EDD inspector |
|                |-----------------------------------|    / diff viewer |
|                |  Live "alive" Terminal            |  Render queue +  |
|                |  Thinking... Analyzing footage... |  progress        |
+----------------+-----------------------------------+------------------+
| model[Opus|Sonnet|Haiku] effort[low..max] mode[plan|auto] perms | usage[####----] |
+--------------------------------------------------------------------------------------+
```

## Control surface (PRD §18.2)
Model picker (opus-4-8 / sonnet-4-6 / haiku-4-5) → CLI `--model`. Effort (low/medium/high/xhigh/max)
+ a global fast-vs-quality bias the Director propagates. Mode (plan/auto). Permissions (per-category
gating). Exactly the controls the user envisioned.

## Usage & limits meter
Live token/cost for the session + progress toward the user's Claude plan limits (from CLI usage
events) + an "approaching limit" warning (the user's explicit ask). Sourcing: Appendix C §6.

## Media drop & workspace
Drag-drop a clip to import into the active project (or create one); left rail browses projects/
assets; selecting an asset scopes "this clip".

## Preview & EDD inspector
Sandboxed iframe preview (open-design pattern). EDD inspector = navigable Video AST tree with
provenance ("why is this here?") + version diff ("what changed when I asked for a punchier hook?").
This is how "explainable/inspectable" becomes tangible.

## Canonical interaction (the promise)
Open app → terminal already open → environment prepares (tiered install) → drop clip + "Edit this
into a premium reel" → terminal comes alive (Thinking… Analyzing footage… Building transcript…
Detecting silence… Finding jump cuts… Generating timeline…) → plan-mode blueprint → approve →
(Generating B-roll… Rendering captions… Optimizing audio… Running FFmpeg… Rendering preview…
Validating output…) → preview + QA → "ship it for Instagram" → verified export. No timeline touched;
no manual installs.

## The "alive" terminal (PRD §19)
Two layers: the **alive** layer (human-legible status lines mapped from events — PRD §19.2) and the
**raw** layer on demand (actual commands, ffmpeg lines, stderr, exit codes — the "connected terminal
behind the scenes" the user asked for). Long ops run in the background with progress/ETA + completion
notifications. Errors translated to plain language with a "show details" disclosure.

## Accessibility & design language
Full keyboard control (command palette), screen-reader labels, high-contrast + reduced-motion,
scalable type. Premium, restrained, brand-aware (open-design/Claude Design sensibility); dark-first
with a light option; the app's own UI uses a design-token system (project STYLE.md governs outputs).
