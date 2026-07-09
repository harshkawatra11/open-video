# ADR-0006: Render via Remotion + FFmpeg composite, with a PNG-sequence fallback

- **Status:** Accepted
- **Related:** PRD §15, §30.4; PoC finding F6

## Context
We need rich, declarative motion graphics and captions AND deterministic media operations (cut,
grade, loudness, encode). In the PoC, Remotion's native compositor binary crashed on the Windows
machine (the bundled Rust/ffprobe binary failed on any input); the final video shipped only because
the graphics were rendered as a transparent PNG sequence via headless Chrome and composited with
the system FFmpeg.

## Options considered
1. **Remotion (React graphics) + FFmpeg composite, with native-or-PNG-sequence fallback** — best of
   both substrates; robust to the exact failure we hit. Con: two substrates + a fallback path.
2. **FFmpeg-only** (drawtext/overlay) — one tool. Con: weak for rich motion/word-level caption
   animation; PoC hit drawtext font/complexity pain.
3. **Remotion-only (native compositor)** — one declarative engine. Con: the native compositor
   failed in the PoC; heavy for raw media ops.
4. **HyperFrames (HTML/CSS/GSAP → MP4) as the engine** — strong captions. Con: cut-sensitive,
   narrower; better as an optional renderer plugin.

## Decision
Use **Remotion for graphics/captions + FFmpeg for media and final composite**, and support **both**
the native Remotion render and a **PNG-sequence (headless Chrome) + FFmpeg** fallback, selected
automatically via a health check (with manual override). Offer HyperFrames as an optional renderer
plugin.

## Rationale
Combines declarative graphics with deterministic media, and is robust against the single most
disruptive failure observed in the PoC. The fallback is already proven to ship real output.

## Consequences
- Positive: rich graphics + reliable rendering across machines; no single point of render failure.
- Negative: more render-path code; two graphics-render modes to maintain.
- Mitigations: health-check + cache the choice in the capability profile; "doctor" re-checks it;
  golden-frame tests cover both paths.

## Revisit when
The native compositor becomes reliably healthy across target machines (could default to native and
keep the fallback only for exceptions).
