# 23 — Cockpit Screens & UX

> The screen-by-screen UX of the OpenVideo Studio. Stack: Next.js + Tailwind + shadcn (ADR-0009);
> design language: doc 22 (Obsidian). Talks to the daemon over the Edit/Session protocol + SSE
> (PRD §8.7). Every surface serves BOTH personas — **Auto** ("drop + one-liner") and **Operator**
> ("control every frame") — via progressive disclosure. Expands PRD §18–§19 and doc 13.

## 0. The two modes (one surface)
- **Auto:** the user gives footage + a one-liner (or a brief that becomes a PRD prompt, doc/PRD §16).
  The Director plans and executes end-to-end; the user watches the "alive" terminal and approves the
  plan. Inspector controls exist but are untouched.
- **Operator:** the same project, but the user drives the Inspector, Timeline/EDD, Color, Audio,
  Caption studio, Library, Brand Kit directly. Every agent action is an editable EDD patch, so manual
  and agentic edits interleave losslessly (same EDD, git-versioned).
- The **mode toggle** (Auto ⇄ Operator) + **plan/auto** + **permissions** live in the top bar; switching
  never loses state.

## 1. App shell
```
┌─ TOP BAR ───────────────────────────────────────────────────────────────────────────────────┐
│ ◆ OpenVideo  [Project ▾]      ⌘K Search / Do anything           Opus▾ effort:high▾ Auto▾ 🔒▾ │
│                                                          usage ▮▮▮▮▯▯  ⟳ queue(2)   ⚙        │
├─ LEFT RAIL ─┬─ MAIN ───────────────────────────────────────────────┬─ INSPECTOR (contextual) ┤
│ ▸ Projects  │                                                       │                         │
│ ▸ Assets    │   (screen content)                                    │                         │
│ ▸ Library   │                                                       │                         │
│ ▸ Brand Kit │                                                       │                         │
│ ▸ Agents    │                                                       │                         │
│ ▸ Plugins   │                                                       │                         │
│ ▸ Renders   │                                                       │                         │
│ ▸ Settings  │                                                       │                         │
├─────────────┴───────────────────────── BOTTOM TRANSPORT (Studio only) ────────────────────────┤
│  ⏮ ⏯ ⏭   00:03 / 00:12   ◖────────●────────◗   [Preview ▾] [Render preview] [Export ▾]  Plan✓ │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```
Top-bar controls map directly to the protocol: model→`--model`, effort→`--effort`, mode(plan/auto)→
`--permission-mode`, permissions→gating, usage→`usage.delta` (doc/Appendix C). Render-queue indicator
opens the Render Queue. ⌘K is the universal command palette.

## 2. Screen — Home / Projects
```
┌───────────────────────────────────────────────────────────────────────────┐
│   OpenVideo                                                                 │
│   Production-grade video, from a sentence — or from your own hand.          │   (display type)
│                                                                             │
│   ┌─ Start ─────────────────────────────────────────────────────────────┐  │
│   │   ⬇ Drop footage here   ·   ⌘N New project   ·   ¶ Paste a brief     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   Recent                                                                    │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                      │
│   │ thumb    │ │ thumb    │ │ thumb    │ │ thumb    │   (premium cards:     │
│   │ Reel·9:16│ │ Short·16:│ │ Reel·9:16│ │ +  New   │    thumb, platform,   │
│   │ 0:48 ·v3 │ │ 8:20 ·v1 │ │ 1:02 ·v2 │ │          │    duration, version) │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘                      │
└───────────────────────────────────────────────────────────────────────────┘
```
Empty state is editorial (large display type, one clear path). Dropping footage creates a project,
ingests+probes it (doc/PRD §11), scaffolds an EDD, and opens the Studio.

## 3. Screen — The Studio (the editor; the heart)
```
┌─ MAIN ─────────────────────────────────────────────┬─ INSPECTOR ──────────────┐
│ ┌ Conversation ──────────────┐ ┌ Preview / Timeline │ Selected: caption "VOID" │
│ │ › turn this into a premium  │ │  ┌───────────────┐ │ ─ Style ── premium ▾     │
│ │   reel                      │ │  │   9:16 frame  │ │ size 64  weight 800      │
│ │ ● Analyzing footage…        │ │  │   (sandboxed) │ │ emphasis: gold+glow ✓    │
│ │ ● Building transcript…      │ │  └───────────────┘ │ font: [Anton ▾] (Studio) │
│ │ ▸ Plan ready  [Approve][✎]  │ │  [Preview｜Timeline]│ safe-margin 120px        │
│ ├ Alive terminal ────────────┤ │ ── tracks ──────── │ start 0.62  end 0.80     │
│ │ Finding jump cuts…  62%     │ │ a-roll ▮▮▮▮▮▮▮▮▮▮  │ [why? ▸ CaptionAgent]    │
│ │ ⌄ show raw                  │ │ captions ▯▮▯▯▮▮▯   │                          │
│ └─────────────────────────────┘ │ graphics ▯▯▮▮▯     │ (full manual controls    │
│                                  │ b-roll  ▯▮▮▯▯     │  for the selected node)  │
│                                  │ audio   ▮▮▮▮▮▮▮▮  │                          │
│                                  │ music   ▮▮▮▮▮▮▮▮  │                          │
│                                  │ vfx     ▯▯▮▯▯     │                          │
└──────────────────────────────────┴───────────────────┴──────────────────────────┘
```
- **Left:** chat (intent in) + the **alive terminal**. Plan proposals + inline permission prompts
  render here as approve/amend/reject cards.
- **Center:** **Preview** (sandboxed iframe; transport/scrubber in the bottom bar) with a toggle to
  the **Timeline/EDD** — the generated timeline as tracks (a-roll · captions · graphics · b-roll ·
  audio · music · sfx · vfx). Clips/keyframes are selectable; selecting routes to the Inspector.
- **Right Inspector:** full manual controls for the selected node, plus **provenance** ("why is this
  here?" → which agent + rationale) and a **diff** affordance ("what changed when I asked for a
  punchier hook?"). This is the Operator's cockpit.
- **Alive terminal:** two layers — friendly status (mapped via `friendlyTerminalLine`, doc/PRD §19.2)
  and a "show raw" disclosure (real ffmpeg/remotion/CLI lines). Long jobs run in background w/ ETA.

## 4. Screen — Brand Kit / STYLE editor
Visual editor over the project STYLE.md: palette swatches, display+caption **fonts (opens Font
Studio)**, caption style (size/weight/emphasis/safe-margins) with live caption preview, motion
amplitude, audio targets (LUFS), b-roll/music policy, anti-patterns. "Derive from a reference"
proposes a kit. Saving commits STYLE.md (git) and re-lowers affected EDD nodes (incremental).

## 5. Screen — Library browser  (detail: doc 24)
Tabs: **Fonts · B-roll · Music/Discography · SFX · AI Images · Templates/Looks**. Grid of asset cards
with hover-preview (video hover-scrub, audio mini-waveform, live font preview), a **license badge** on
each, and actions: *Insert into timeline* / *Set as style* / *Override*. Key-gated providers show
"Add key to enable" (→ Settings keystore). Curator agent can auto-pull on-brand, copyright-safe assets.

## 6. Screen — Color
Grade controls: tonemap toggle (HLG→Rec.709), white balance, contrast curve, vibrance, sharpen,
vignette; before/after split; (scopes later). Edits write the EDD color effect; preview re-renders the
affected node only (incremental cache).

## 7. Screen — Audio mixer
Voice chain (HPF/denoise/de-ess/EQ/compress), **loudness target -14 LUFS** with a meter, music bed +
**side-chain ducking**, SFX cues on a mini-timeline. Maps to the EDD audio track + `level_audio`.

## 8. Screen — Caption studio
Word-level styling, emphasis-term list, karaoke preview, language/romanization (Hinglish etc.),
safe-margins, font from Font Studio. Maps to the EDD captions track + the Remotion caption component.

## 9. Screen — VFX (object removal · VOID)  (detail: doc 25)
Select/track a region on the preview → preview removal → apply. Heavy/GPU + tiered-install gated;
shows a one-tap consent + download progress on first use; long-job progress in the queue.

## 10. Screen — Footage analysis  (detail: doc 25)
The agent's visual read (claude-video): keyframe strip, shot list, on-screen text, energy curve,
dead/usable ranges — feeding smarter planning. "Re-analyze" button; results annotate the timeline.

## 11. Screen — Render Queue
Jobs with phase/%/ETA, cache-hit indicators, cancel, and output cards (play / reveal / export).
Completion raises a notification.

## 12. Screen — Settings / Installer / Doctor
Hardware profile (GPU/RAM/disk), the **tiered installer** (core auto; heavy items with size+consent;
repair/rollback), the **keystore** (provider/API keys, write-only, encrypted), model/effort defaults,
theme, and a **Doctor** that re-profiles + self-heals (incl. Remotion-compositor health → PNG-seq
fallback, ADR-0006).

## 13. Screen — Usage
Session token/cost + progress toward the user's Claude plan limits + an "approaching limit" warning.

## 14. Command palette (⌘K) & keyboard
⌘K does anything: new project, import, run intent, switch model/effort/mode, open any screen, insert
from library, render preview, export, toggle raw terminal, open Doctor. Core keys: Space play/pause,
J/K/L shuttle, I/O in/out, ←/→ frame step, ⌘Z/⌘⇧Z undo/redo (EDD git), ⌘Enter run intent,
⌘B toggle left rail, ⌘/ toggle inspector, ⌘E export.

## 15. The two canonical journeys
- **Auto:** Home → drop clip → "make a premium reel" (optionally "draft to PRD first") → approve plan
  → watch the alive terminal → preview → "ship for Instagram" → export. No timeline touched.
- **Operator:** Home → drop clip → open Timeline → pick a font in Font Studio, set the grade in Color,
  drop a b-roll from Library onto the b-roll track, tune captions, adjust loudness, remove an object
  in VFX → preview → export. Agents available on demand ("tighten the pacing here") as EDD patches.
