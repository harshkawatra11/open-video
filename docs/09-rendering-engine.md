# 09 — Rendering Engine

> Expands PRD §15. Two substrates (Remotion + FFmpeg), one composite model, automatic native-vs-
> PNG-sequence selection (ADR-0006). Concrete commands: Appendix B.

## Substrates
- **FFmpeg/FFprobe** — decode, cut/trim, crop/scale/position, speed, concat, overlay, color
  (zscale/tonemap, curves, colorbalance), denoise (afftdn), loudness (two-pass loudnorm), limiter,
  encode (libx264/NVENC), mux, faststart, inspection.
- **Remotion (headless Chrome)** — declarative React components for captions, lower-thirds, kinetic
  headlines, comparison cards, flow diagrams, timelines, CTAs, vector b-roll. Deterministic frames
  from EDD-resolved props.

## Composite model
Render graphics/captions as a transparent layer (PNG sequence or alpha MP4) → composite over the
graded, cut a-roll with FFmpeg → mux the final audio mix. Exactly the path the PoC shipped.

## Native vs PNG-sequence (ADR-0006)
- **Health-check** the Remotion compositor binary at install/first-use (the PoC's failure was the
  bundled Rust/ffprobe binary crashing on any input).
- Healthy → native render. Unhealthy → render graphics as a transparent PNG sequence via headless
  Chrome (works regardless) + FFmpeg composite.
- Choice cached in the capability profile; overridable; re-checked by "doctor".

## FFmpeg responsibilities (typed, not raw shell)
Cutting/assembly; spatial (crop/scale/position, alternating breathe punch-in curve); color (HLG/HDR →
Rec.709 SDR tonemap, WB, S-curve, vibrance, light unsharp, optional vignette, correct color tags);
audio (HPF, afftdn, de-ess, presence EQ, compression, loudnorm to target, alimiter, music sidechain
duck, SFX); encode/mux (libx264 CRF/preset or NVENC; AAC; +faststart; platform pix_fmt/profile).

## Remotion responsibilities
A bundled, project-local Remotion project with brand-aware components driven by `STYLE.md` tokens
(Captions w/ word-level karaoke + emphasis, Hook, LowerThird, Checklist, comparison cards,
FlowDiagram, Timeline, CTA, BrandBug, vector b-roll). The Motion agent authors props in the EDD.

## GPU / CPU
Encode: NVENC when present, else libx264. ASR: CUDA torch when supported (30–50×), else CPU. Decode/
scale: hardware where available. Scheduler routes GPU-eligible nodes to the GPU pool; every node has
a CPU path (T4).

## Color, codecs, HDR/SDR
Default deliverable Rec.709 SDR (tonemapped) for phone-consistent color; HDR export is a roadmap
option. H.264 default (max compat), HEVC optional. Platform presets control resolution/fps/bitrate/
profile/faststart. Optimization agent targets platform size norms without visible loss.

## Preview vs final
Preview: proxy res, fast preset, possibly partial range, cached aggressively. Final: full res, high
quality (e.g. CRF 18, slow preset), verified (ffprobe + loudness).

## Sync & timing
Frame-accurate sync via the IR's normalized time base; caption word timing ≤ 80 ms; head-trims
applied consistently to video + audio (PoC's 0.5 s lead-in). Motion uses eased interpolation from the
motion language; frame interpolation is a roadmap item.

## Output targets
Platform presets (IG Reel: 1080×1920, 60 fps, H.264 High, AAC 48k, +faststart, ≈ −14 LUFS). New
presets ship as data/plugins.
