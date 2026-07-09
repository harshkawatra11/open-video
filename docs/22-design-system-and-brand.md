# 22 — Design System & Brand ("Obsidian")

> The agency-grade, jet-black design system for the OpenVideo **app UI**. This is distinct from the
> project **STYLE.md** (which governs rendered *video* output — see `14-style-and-design-system.md`).
> Both are token-driven. Source of truth in code: `packages/design-tokens` (+ a Tailwind preset).
> Decision: ADR-0012. Stack: ADR-0009 (Next.js + Tailwind + shadcn/ui).

## 0. Design principles
- **Jet-black, editorial, calm.** A true near-black canvas; content and footage are the only color.
  Premiere/Resolve professionalism + Claude/Open-Design restraint. No "AI-slop" gradients, no blurple.
- **Footage is the hero.** Chrome recedes; the preview, the timeline, and the assets carry the color.
- **Two users, one surface.** Every screen works for "drop a clip + one line" *and* "control every
  frame." Power is present but progressively disclosed.
- **Earn motion.** Motion communicates state (streaming, rendering, applying) — never decoration.
- **Keyboard-first, accessible.** ⌘K does anything; AA contrast minimum; reduced-motion honored.

## 1. Color — the Obsidian ramp
Neutrals are warm-graphite, not blue-black. Tokens (dark theme is canonical):

```
--bg-0   #050506   app canvas (jet black)
--bg-1   #0A0B0D   base surface
--bg-2   #0E0F12   panel
--bg-3   #16181D   raised panel / popover
--bg-4   #1E2127   input / hover
--line-1 rgba(255,255,255,0.06)   hairline
--line-2 rgba(255,255,255,0.10)   border
--line-3 rgba(255,255,255,0.16)   strong border / focus ring base
--fg-0   #F4F5F7   primary text
--fg-1   #C2C7CF   secondary text
--fg-2   #8A92A0   muted / placeholder
--fg-3   #5A626E   disabled
```

Accent + semantic + editorial category hues:
```
--accent        #C9A227   primary (warm gold)         --accent-hi #E7C766  --accent-press #A8851C
--success #2FBF71   --warn #E5A13A   --error #E2473B   --info #4C9BE8
category chips: fonts #B98CFF · b-roll #4CC2A6 · music #F2A65A · sfx #6EA8FF · images #E06CB0 · vfx #E2473B
```
Rules: accent is for the single primary action / active state / emphasis only. Category hues are for
library/track identity, used at low saturation as 1px accents and chips — never as fills behind text.
Contrast: body text on `--bg-*` ≥ 4.5:1; large/secondary ≥ 3:1. A light theme is a later token swap.

## 2. Typography (app UI) — maximised, self-hosted
Pairing (self-hosted via `@fontsource`, offline-safe):
- **Display / headings:** a confident grotesk (e.g. *Space Grotesk* or *Geist*) — editorial weight.
- **UI / body:** a neutral, highly legible sans (e.g. *Inter* or *Geist Sans*).
- **Mono:** the terminal, EDD, code, timecodes (e.g. *Geist Mono* / *JetBrains Mono*).

Type scale (modular ~1.2, rem):
```
display-xl 44/48 700 · display 32/38 700 · h1 24/30 650 · h2 20/26 600 · h3 16/22 600
body 14/20 450 · body-sm 13/18 450 · label 12/16 550 (tracking +0.02em, uppercase for section labels)
mono 13/18 450
```
Numeric: tabular figures everywhere numbers align (timecodes, meters, durations).
> NOTE: project/output fonts are the **live Google Fonts catalog** (Font Studio) — §6 + doc 24.

## 3. Space, grid, radius, elevation
- **Spacing scale (px):** 2 4 6 8 12 16 20 24 32 40 48 64. Default gutter 16; dense panels 8–12.
- **Studio grid:** `[ left rail 56–280 ] [ main flex ] [ right inspector 0–360 ]` over `[ top bar 52 ]`
  and `[ bottom transport 0–88 ]`. Panels are resizable (persisted) and collapsible.
- **Radius:** `sm 6 · md 10 · lg 14 · pill 999`. Inputs/cards md; dialogs lg.
- **Elevation:** by surface tint (bg-1→bg-3) + hairline + a soft dark shadow
  (`0 8px 24px rgba(0,0,0,0.5)` for popovers/dialogs). Never rely on shadow alone on jet-black.

## 4. Motion
- Durations: micro 120ms · standard 200ms · large 320ms. Eases: standard `cubic-bezier(.2,.7,.2,1)`,
  enter `cubic-bezier(0,.7,.2,1)`, exit `cubic-bezier(.4,0,1,1)`.
- **Framer Motion** for UI (panel open, list stagger, dialog). **GSAP** for "alive" moments (terminal
  line-in, render-progress sweep, library hover-scrub). All gated by `prefers-reduced-motion`.

## 5. Iconography
One line-icon family (Lucide) for generic actions + a small custom set of **editing primitive marks**
(cut, grade, caption, b-roll, music, sfx, vfx, image, voiceover-later) tinted by category hue.

## 6. Fonts as a product surface (Font Studio) — Google Fonts
The app *uses* a curated self-hosted set; the *project/output* picks from the **entire Google Fonts
catalog**. Font Studio (doc 24 §Fonts): search, filter (category/weights/subsets), **live preview on
the user's own caption text**, favorites, AI pairing suggestions. Fetch is **keyless**: a bundled
catalog index + on-demand family load via the Google Fonts CSS2 endpoint / `@fontsource`. Chosen
fonts resolve into STYLE.md `typography`/`caption` tokens and the Remotion caption components.

## 7. Component inventory (shadcn/ui + Radix + custom)
Primitives: Button (primary/secondary/ghost/danger), IconButton, Input, Textarea, Select, Combobox,
Slider, Switch, Checkbox, Radio, SegmentedControl, Tabs, Tooltip, Popover, Dialog/Sheet, DropdownMenu,
ContextMenu, Toast, Progress, Badge/Chip, Avatar, ScrollArea, ResizablePanels, Command palette (cmdk),
Skeleton, EmptyState.
Studio components (custom): TopBar, LeftRail, Inspector, AlieveTerminal, ChatThread, PreviewSurface +
Transport/Scrubber, TimelineEDD (tracks/clips/keyframes), Waveform, ColorGradeControls, AssetCard,
LibraryGrid, FontCard, BrandKitEditor, UsageMeter, RenderQueueItem, PermissionPrompt, PlanProposal,
ModelEffortModeControl, DropZone, LicenseBadge.

## 8. Accessibility
Visible focus ring (accent at 2px + offset), full keyboard nav + roving tabindex on the timeline,
ARIA roles/labels, SR-only live region for terminal/render status, color never the sole signal
(icons+text on chips/badges), respects reduced-motion + system contrast, target ≥ 32px hit area.

## 9. Theming & tokens in code
`packages/design-tokens` exports the tokens as TS objects + CSS variables + a **Tailwind preset**
(colors/spacing/radius/fontFamily/shadow). shadcn components consume the CSS vars. Dark is default and
canonical; a light theme is an alternate variable set (later). The output STYLE.md defaults reuse the
brand palette/fonts but are independently editable per project.

## 10. Brand kit (per project)
A first-class **Brand Kit** surface (doc 23 screen 4) editing: logo/handle, palette, display+caption
fonts (Font Studio), caption style, motion amplitude, audio targets (LUFS), b-roll/music policy,
anti-patterns. Persists to the project STYLE.md; reused across edits; "derive from a reference"
proposes a kit. This is how brand consistency holds across many videos.
