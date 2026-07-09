# 14 — Style & Design System (STYLE.md)

> Expands PRD §13.6, §18.9. OpenVideo's analog to open-design's `DESIGN.md`: a per-project (or
> shared) file that constrains every output. Two scopes: the app's own UI tokens, and the project's
> output look system.

## Why a "system file"
open-design's key insight (PoC/study F12): a single, human-readable system file that every generated
artifact must respect is a powerful, simple primitive. For video, the look/brand of the output is at
least as important as for design — captions, color, motion, and pacing must be cohesive and
on-brand.

## STYLE.md sections (output look system)
```
identity / voice         tone, audience, do/don't
palette                  bg, fg, accent(s) (hex), usage rules
typography               display face, body/caption face, weights, scale
caption                  size, weight, highlight style, emphasis treatment (e.g. key terms gold +
                         scale + glow), safe margins (>=120px), position (off eyeline)
motion language          eases, duration ranges, punch-in amplitude (e.g. 3%), entrance styles
pacing                   max static-frame duration (e.g. 3-4s), cut density guidance
audio                    target LUFS (e.g. -14), true-peak ceiling, music ducking policy
grade                    default look, white balance, contrast, vibrance; anti-patterns
                         ("no teal-orange", "protect skin")
broll                    policy (generated/licensed/royalty-free only; never scrape)
anti-patterns            explicit "never do" list
```
(Section schema: Appendix D §8.)

## How it's used (lowering)
EDD nodes reference style tokens (`styleRef: "style.caption.premium"`); the compiler's lowering pass
resolves them to concrete values from STYLE.md (fonts, colors, sizes, eases, LUFS targets). Change
STYLE.md → re-lower → only affected nodes re-render (incremental).

## Authoring paths
1. **User-authored** — edit STYLE.md directly.
2. **Derived** — "make it feel like MagnatesMedia/Hormozi/Ali Abdaal" → the Style agent proposes a
   STYLE.md (how far to push style transfer vs explicit tokens is Open Question Q4).
3. **Plugin (look system)** — install a shareable STYLE.md pack / brand kit (PRD §20.2).

## App UI design system
The cockpit's own UI uses a design-token set (color/space/type/motion) in the open-design/Claude
Design sensibility (premium, restrained, dark-first + light). Kept distinct from the project's output
STYLE.md, though both are token-driven.

## Brand consistency across a project
The Director consults STYLE.md + project memory so successive edits stay on-brand without the user
re-specifying every time.
