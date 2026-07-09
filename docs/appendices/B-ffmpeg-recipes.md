# Appendix B — FFmpeg / Whisper / Remotion recipes (proven in the proof-of-concept)

These are the canonical, **already-proven** invocations distilled from the proof-of-concept
(summary.txt). They are the exact behaviors the typed media tools (PRD §8.6, §15) construct and
validate. Paths/values are illustrative; the engine resolves them from the EDD/IR.

> All FFmpeg use in the product is via **typed tool specs**, not raw model-authored shell. These
> recipes document the *intended* commands so the tool wrappers and golden tests can target them.

---

## 1. Inspect a source (FFprobe)
```
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,codec_name,color_transfer,color_space \
  -show_entries format=duration -of json input.mp4
```
PoC result example: 1080×1920, 60 fps, h264, HLG/bt2020, ~66.2 s.

## 2. Extract audio for ASR
```
ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le work/audio.wav
```

## 3. Transcribe (Whisper / faster-whisper)
```
# CPU (slow; PoC: large-v3 ~40+ min for 66s) or CUDA (30–50x faster)
whisper work/audio.wav --model large-v3 --word_timestamps True \
  --output_format json -o work/   --device cuda
```
Notes (PoC): set `PYTHONUTF8=1` on Windows to avoid cp1252 console crashes on multilingual output;
the small model gave poor word timings — anchor captions to a capable model's segment timings and
distribute words within segments. Romanization (Hinglish) is applied by the Caption agent while
preserving timings.

## 4. Audio leveling to −14 LUFS + gentle denoise (two-pass loudnorm)
Pass 1 — measure:
```
ffmpeg -i input.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -
# PoC measured input ≈ -20.98 LUFS, input_tp ≈ -1.44
```
Pass 2 — apply (reuse measured values) + light hiss reduction; copy video losslessly:
```
ffmpeg -i input.mp4 \
  -af "afftdn=nr=10:nf=-25, loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-20.98:measured_TP=-1.44:measured_LRA=..:measured_thresh=..:linear=true" \
  -c:v copy -c:a aac -b:a 192k IMG_1554_yt.mp4
```
PoC verified output ≈ −14 LUFS, true peak ≈ −1.5 dBTP. (`afftdn=nr=10:nf=-25` = very gentle.)

## 5. HLG/HDR → Rec.709 SDR tonemap + light grade
```
ffmpeg -i input.mp4 -vf "
  zscale=t=linear:npl=100, format=gbrpf32le,
  zscale=p=bt709, tonemap=hable:desat=0,
  zscale=t=bt709:m=bt709:r=tv, format=yuv420p,
  colorbalance=..., curves=preset=medium_contrast, vibrance=intensity=0.1,
  unsharp=5:5:0.6
" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p work/aroll_graded.mp4
```
PoC: produced a clearly better, phone-consistent SDR image vs the washed-out raw HLG; avoid
over-grading / teal-orange; protect skin tones.

## 6. Cut detection (scene / frame-diff)
```
# Per-frame difference scores; cluster spikes (merge within ~0.5s) into cut points.
ffmpeg -i input.mp4 -vf "select='gt(scene,0)',metadata=print:file=work/scores.txt" \
  -an -f null -
# Talking-head footage often has tiny scene scores; use relative spikes, not a fixed threshold,
# and verify the strongest candidates visually (PoC found ~20 cuts this way).
```

## 7. Smart-cut: silence / hesitation detection
```
ffmpeg -i input.mp4 -af silencedetect=n=-32dB:d=0.35 -f null -
# Parse silence_start/end; trim dead air (PoC: mainly a 0.57s lead-in) while preserving natural
# speech. Apply the SAME head-trim to video and audio to keep sync (PoC trimmed 0.5s).
```

## 8. Alternating "breathe" punch-in per cut segment (≈3%, centered)
Per segment, alternate zoom direction so it never stacks and the jump cut reads as intentional:
```
# odd segments 1.00 -> 1.03, even segments 1.03 -> 1.00, eased, centered.
# Implemented as a per-segment scale+crop (or zoompan) expression keyed to the cut boundaries;
# consecutive segments meet at the same scale (no pop). Re-encode at CRF 18.
```

## 9. Render graphics/captions (Remotion) — native, else PNG-sequence fallback
```
# Native (preferred when the compositor binary is healthy):
npx remotion render Overlay out/overlay.mov --codec=prores --pixel-format=yuva444p10le

# Fallback (PoC-proven on Windows when the native compositor crashed):
npx remotion render Overlay out/seq                # transparent PNG sequence (element-%04d.png)
```
The engine health-checks the Remotion compositor and selects automatically (ADR-0006).

## 10. Final composite + mux (a-roll + breathe-zoom + overlay PNG seq + mixed audio)
```
ffmpeg -i work/aroll_graded.mp4 \
  -framerate 60 -i out/seq/element-%04d.png \
  -i work/mix.wav \
  -filter_complex "[0:v]<breathe-zoom expr>[v0]; [v0][1:v]overlay=0:0[v]" \
  -map "[v]" -map 2:a \
  -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -profile:v high -level 4.2 \
  -r 60 -s 1080x1920 -c:a aac -b:a 192k -ar 48000 -movflags +faststart \
  out/final-edit.mp4
```

## 11. Verify the deliverable
```
ffprobe -v error -show_format -show_streams out/final-edit.mp4
ffmpeg -i out/final-edit.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -
# PoC final ≈ -13.2 LUFS, -0.5 dBTP, 1080x1920, 60fps, H.264 High, AAC 48k, +faststart.
```

## 12. Replace audio (lossless video copy) + re-level
```
ffmpeg -i out/final-edit.mp4 -i clean-audio.mp3 -map 0:v -map 1:a -c:v copy -shortest tmp.mp4
# then re-level tmp.mp4 to -14 LUFS as in recipe 4 (PoC: clean-audio was -21.8 LUFS, raised to -13.8).
```

## 13. Authorized import (yt-dlp)
```
yt-dlp -f "bv*+ba/b" -o "downloads/%(title)s.%(ext)s" <authorized-url>
# Quarantine in downloads/; promote to assets/ only on user approval (permission-gated).
```

---
**Platform export preset (Instagram Reel):** 1080×1920, 60 fps, H.264 High, CRF ~18 / target
bitrate ~10–16 Mbps, AAC 48 kHz, `+faststart`, integrated loudness ≈ −14 LUFS, true peak ≤ −1.0 dBTP.
