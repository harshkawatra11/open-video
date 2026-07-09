# Video Edit Workspace — Workflow & Standards

Read this before touching anything in this workspace. It captures the toolchain, standards, and
workflow this project runs on. Follow it by default; only deviate if `PRD.md` explicitly says
otherwise. You have full tool freedom here (Bash, Write, Edit) — there is no fixed schema you must
patch. Write real ffmpeg commands and real Remotion components for this specific edit.

## Brand / client context

{{BRAND_CONTEXT}}

## Workspace layout

```
./
├─ source.mp4 (or original filename)   # untouched source — never overwrite this
├─ transcript.txt (if supplied)
├─ PRD.md                               # the brief for this specific edit — read it first
├─ work/            # scratch: graded/punch a-roll, mix.wav, gen_captions.cjs, QA stills
├─ remotion/        # this project's Remotion overlay composition (pnpm-installed, isolated)
├─ memory/
│  └─ learnings.txt # craft knowledge carried in from prior edits — read it, and append to it
└─ out/final-edit.mp4   # ★ deliverable
```

## Toolchain

- **ffmpeg** (has `zscale`/`zimg` for HDR tonemap) — the primary workhorse for audio processing,
  color grading, cuts, and final compositing.
- **whisper** (CPU-only unless a GPU is confirmed present) — for transcription/word-timing **only
  when no transcript already exists**. If `transcript.txt` is supplied (even a plain SRT-style
  `.txt`), use it directly — do not re-transcribe.
- **Remotion** (pinned in `remotion/package.json` — do not change the version) — for all motion
  graphics/captions/overlays. **Already `pnpm install`-ed by the scaffolder; if you add a
  dependency, use `pnpm install` inside `remotion/`, not `npm install`** — pnpm's content-addressable
  store hardlinks identical package versions across project folders instead of duplicating them.
- **hyperframes** CLI — available for talking-head caption embeds or graphic-overlay packaging when
  it's a better fit than a hand-authored Remotion component for a specific beat.
- **claude-video** (`watch` skill) — lets you actually watch the source video (downloads, extracts
  frames, transcribes, reads frames as images) instead of manually building ffmpeg contact sheets.
  Prefer this for the initial "watch every frame" analysis phase.

## Known environment issue — Remotion compositor crash (Windows)

The native Remotion Windows compositor binary can crash (`ffprobe.exe` access violation).
**Workaround (always use this — do not attempt the native render path):**
1. Build all graphics/captions as a transparent-background composition (see `remotion/src/Overlay.tsx`
   skeleton — no video/audio elements inside it).
2. Render it as a **PNG sequence** via Chrome headless: `Config.setVideoImageFormat("png")` in
   `remotion.config.ts` (already set), then `npx remotion render Overlay out/overlay --sequence` (no
   `--codec` flag — that errors for sequence output).
3. Composite the PNG sequence over the graded a-roll with **system ffmpeg** (`overlay` filter),
   muxing in the final audio mix. Never attempt `--codec h264` etc. on the Overlay composition.
4. **Frame filename padding width varies by frame count** — Remotion pads to fit the largest frame
   number, so a short reel might write `element-0000.png` (4 digits) while a longer video writes
   `element-00000.png` (5 digits). Always `ls` the actual output directory and match the glob
   pattern to what's really there before compositing — don't assume a fixed width.

## Standard audio processing

1. Measure input loudness first (`loudnorm=print_format=json`, single pass) to get
   `measured_I`/`measured_TP`/`measured_LRA`/`measured_thresh`.
2. Two-pass `loudnorm` to **YouTube/IG standard: I=-14 LUFS, TP=-1.5 dBTP, LRA=11**, using the
   measured stats from step 1 (`linear=true`) for accuracy.
3. Add `alimiter=limit=-1.0dB` as a safety ceiling after loudnorm.
4. Light denoise only if the source has audible hiss/rumble (`afftdn=nr=12:nf=-25`,
   `highpass=f=80`) — **skip if audio is already pre-cleaned** (e.g. Adobe Podcast Enhanced); don't
   over-process clean dialogue.
5. If a separate cleaned-audio file is supplied, that replaces the original audio track entirely
   rather than being layered on top of it.
6. Music/SFX: **royalty-free or user-supplied only.** Never source or use copyrighted/scraped audio.
   If none is supplied, flag it and proceed music-less rather than substituting something
   copyrighted.
7. Output the final mix to `work/mix.wav` (high-quality intermediate, fed to the Remotion preview
   and the final ffmpeg composite).

## Standard color grading

- Check source color space first (`ffprobe -show_entries stream=color_transfer,color_primaries`).
  If HDR/HLG, tonemap to Rec.709 SDR first:
  `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`.
  If already bt709 SDR, skip tonemap.
- Then apply a light cinematic grade: gentle contrast/saturation lift
  (`eq=contrast=1.05-1.08:saturation=1.08-1.12`), subtle white-balance correction (`colorbalance`),
  a medium-contrast curve, and light `unsharp` sharpening. Keep skin tones natural — no
  teal-orange, no heavy vignette, unless `PRD.md` asks for a specific look.
- Re-grade any pre-existing cutaway/B-roll clips already spliced into the source to match, rather
  than leaving them visually inconsistent.
- Output to `work/aroll_graded.mp4`.

## B-roll & motion graphics — sourcing rule

**Never use scraped stock footage, scraped drone/satellite footage, or scraped copyrighted images/
video clips.** All B-roll and graphics must be either:
- Pure Remotion vector/motion graphics (maps, stat callouts, flow diagrams, comparison cards,
  lower-thirds, brand bug, etc.), or
- AI-generated stills animated with Ken-Burns, or
- Real data (e.g. actual geodata, real statistics) rendered as vector graphics.

If pre-existing B-roll/cutaways/news clips are already spliced into the supplied source video,
those are legitimate (not something we sourced) — keep and re-grade them rather than replacing with
new material, unless `PRD.md` asks otherwise.

## Handling pre-existing burned-in overlays in source footage

Source video is sometimes not raw — it may already be a rough-cut with a watermark, amateur
clipart, text cards, etc. burned into the pixels. Since these can't be lifted out cleanly:
- **Scan the whole source first** at a coarse interval (contact sheet, e.g. `fps=1/5` tiled) before
  planning, to catalog every burned-in graphic and its approximate window.
- To remove/replace: cover with a new graphic of **equal-or-larger footprint** at the same
  timestamp (verify pixel coverage with a QA still — bleed-through at the edges is the most common
  failure mode).
- To simply remove a bug/watermark **without replacing it with anything**: don't leave a blank
  gap — patch by re-compositing that specific screen region from the *graded a-roll itself* (which
  still has the original content) back on top.
- A brand bug intended to cover a watermark must be sized/positioned generously — pad wider than
  your best estimate of the original watermark's bounding box, and verify with a QA still before
  committing to a full render.

## Punch-ins on a single continuous take (no hard cuts in source)

Confirm with `ffmpeg ... -vf "select='gt(scene,0.3)',showinfo"` — if scene-detect finds nothing,
it's continuous. There's no existing cut rhythm to punch on, so manufacture one:
- Build a piecewise `zoompan` expression with alternating push-in/release segments at sentence
  boundaries (silence-detect or transcript-based), plus 2-3 harder punches on emphasis beats.
- Add a gentle stabilizing base crop (~1.04-1.05x) on top, since handheld framing drifts.
- Upscale 2x before `zoompan` to avoid jitter/judder at zoom levels close to 1.0.
- Apply this pass to the graded a-roll *before* Remotion overlay compositing, so the overlay's
  frame-indexed timing lines up with the same (already zoomed) time axis.

## Captions

- Word/segment timing: use Whisper (segment-level timestamps — word-level DTW is often unreliable
  on CPU) **only if no transcript with timestamps is supplied**. If the user's transcript already
  has SRT-style timestamps, anchor to those directly instead.
- For code-switched / mixed-language content: **author captions manually** against the transcript
  rather than mechanically transliterating (mechanical transliteration reads wrong). Keep
  proper-noun/technical terms in their original script/case, uppercase them for emphasis styling.
- Distribute word timing within known time anchors by character-length proportion (see
  `work/gen_captions.cjs` for the pattern) when only segment-level (not word-level) timestamps are
  available. Use as many real anchor points as you can find rather than one giant span — this keeps
  drift local instead of compounding.
- Style default: smooth fade/scale-in per phrase group (2-4 words), **not** karaoke-style per-word
  bounce, unless `PRD.md` asks for karaoke.
- Emphasis styling: uppercase + accent color + underline/glow for named/topical terms defined in
  `PRD.md` or detected as ALL-CAPS tokens. Numbers/figures that are central to the claim being made
  count as emphasis terms too — don't only pattern-match on `ALL-CAPS`.
- **Known bug, must be checked on every new Captions component you write**: an "active word"
  `transform: scale(1.1-1.2)` (used for a karaoke pop, or bigger emphasis-word font sizes) is
  visual-only and does **not** reserve extra layout space, so a scaled-up word visually
  overlaps/collides with its neighbor even though the flex `gap` is technically respected in the
  box model. **This applies to any word that scales while active, not just emphasized ones** — a
  fix that only adds margin to `emph` words still leaves plain active words colliding. Fix:
  `margin: emph ? "0 14px" : active ? "0 10px" : "0 4px"` — compensate every state that triggers the
  scale transform. Catch this by zooming into caption-heavy QA stills across **several different
  beats**, not just one or two.

## Fact-accuracy check before designing claim-bearing graphics

- **Verify every factual claim independently before turning it into a graphic — don't just
  illustrate what the speaker says.** Spoken words are never rewritten (captions stay verbatim), but
  a *graphic* that prints a number or claim as an authoritative-looking stat carries more weight
  than a spoken aside, so it needs to be right.
- Cross-check figures against the most current/authoritative source available (not an earlier
  draft, outdated stat, or unverified claim).
- If the spoken figure doesn't match what you can verify: **do not silently correct the speaker's
  words**, and don't print the disputed figure as a graphic stat either. Show the surrounding
  elements that *are* verified, and flag the discrepancy in your final report rather than guessing
  which is right.

## Render/QA checklist before calling an edit done

1. `ffprobe` the final file: resolution, fps, codec, color tags, `+faststart`.
2. Re-run `loudnorm print_format=json` on the final output and confirm integrated loudness lands
   near -14 LUFS.
3. Pull QA stills at **every major graphic beat** (not just a couple of spot checks) and actually
   look at them — overlay/graphic coverage bugs (bleed-through, scale mismatches, overlapping
   cards) are the most common defect class and are easy to miss without visually checking each beat.
4. Confirm no old burned-in watermark/clipart/text-card is visible unobstructed anywhere.
5. Sanity-check pacing: no single uninterrupted static talking-head shot beyond the retention-risk
   threshold agreed for that edit (check `PRD.md`, or default ~12-15s for long-form, much tighter
   for a reel).
6. Report actual defects found, with timestamps, rather than declaring success — offer to patch
   specific spots, don't silently ship known issues.

## Performance notes

- A full-graphics Remotion PNG-sequence render + ffmpeg composite of an ~8-9 minute 1080p video can
  take **1.5-2+ hours** on CPU/Chrome-headless-only hardware. Plan accordingly and use a background
  job + poll-until-done loop rather than blocking synchronously.
- A ~60s vertical reel (≈1700-1800 frames) is much cheaper — PNG-sequence render is roughly 10-15
  min, and the ffmpeg composite (full re-encode) another 1-2 min.
- Prefer patching a specific defective region (e.g. re-composite one filter chain, or crop/restore
  one screen region) over re-rendering the entire Remotion PNG sequence when only the compositing
  step needs to change. For a reel-sized project a full re-render is cheap enough that this
  tradeoff mostly doesn't matter — just fix and re-render.
- **Windows file-lock gotcha**: `mv`/rename on a directory fails with `Permission denied` or
  `Device or resource busy` if any open shell has its current working directory inside that folder.
  If a rename/move fails for no obvious reason, `cd` out to a parent directory first. `robocopy /E
  /MOVE` is a resilient fallback — its exit codes 0-7 all mean success (bitmask), only 8+ is a real
  failure.

## Before editing anything

- Read `PRD.md` — the brief for this specific edit.
- Read every file in `memory/` — craft knowledge and known bugs carried in from prior edits in this
  system, plus this workspace's own history if this is a tweak/second pass.

## When you finish

- The last line of your final message for a completed edit **must** be exactly:
  `DONE: out/final-edit.mp4`
  This is a deterministic completion marker the orchestrator watches for — do not print it until
  the file actually exists and has passed the QA checklist above.
- Append anything you learned that would help the *next* edit (a bug you hit, a technique that
  worked, a gotcha specific to this kind of source footage) to `memory/learnings.txt` as a new
  dated entry. Be specific — name the failure mode and the fix, not just "fixed captions".
