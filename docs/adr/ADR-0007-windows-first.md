# ADR-0007: Windows-first; macOS and Linux later

- **Status:** Accepted
- **Related:** PRD §4.2, §10.5, §26 (Phase 9), §30.7

## Context
The user's machine is Windows 11 (with an RTX 3050), and the entire proof-of-concept — including
its specific friction (PATH handling, cp1252 console encoding, winget installs, CUDA/torch wheels,
the Remotion compositor failure) — was on Windows. Cross-platform from day one would mean a much
larger Installation Agent and more GPU/codec path work up front.

## Options considered
1. **Windows-first** — match the user's machine and the validated PoC; ship sooner. macOS/Linux as
   a fast follow.
2. **Cross-platform day one** (Win/macOS/Linux) — cleaner OS abstractions up front; slower v1;
   triple the installer/GPU surface (CUDA/Metal/VAAPI).
3. **Windows + macOS** — the two biggest creator desktops; defer Linux. Middle ground.

## Decision
**Windows-first.** Design OS-specific concerns (installer, GPU detection, path handling) behind
clean interfaces so macOS (Metal/VideoToolbox) and Linux (VAAPI) can follow without rearchitecting
(roadmap Phase 9).

## Rationale
Fastest path to a working, validated product on the exact environment we have evidence for; avoids
spreading effort across three platforms before the core is proven.

## Consequences
- Positive: focus; reuse of all PoC learnings; quickest v1.
- Negative: no Mac/Linux at launch (a real market segment).
- Mitigations: keep OS-specific code behind interfaces from the start; prioritize macOS next.

## Revisit when
The Windows product is stable and macOS demand is the top growth lever.
