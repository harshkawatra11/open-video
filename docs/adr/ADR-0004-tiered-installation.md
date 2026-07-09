# ADR-0004: Tiered installation (core auto, heavy on-demand)

- **Status:** Accepted
- **Related:** PRD §10, §30.5; PoC findings F2, F3

## Context
A fresh machine lacks ffmpeg, yt-dlp, Whisper, a suitable Python/torch, model weights, and
possibly CUDA. The PoC showed installation is the first real obstacle, and that large/heavy items
(model weights ~1.5 GB+, CUDA builds) are slow and not always immediately needed. Users dislike
both manual setup and multi-gigabyte surprise downloads.

## Options considered
1. **Tiered** — auto-install the small core (ffmpeg, ffprobe, yt-dlp, node/pnpm, Remotion) silently
   on first run; defer heavy items (Whisper weights, CUDA, model packs) to first use with a one-tap
   confirm. Balances "just works" vs surprise downloads.
2. **Fully autonomous** — detect hardware and install everything up front. Zero-config but a big,
   possibly unwanted first-run download.
3. **Ask before each** — present a checklist; install only approved items. Max control, most
   friction before the first edit.

## Decision
**Tiered.** Core auto-installs; heavy items install on first use with a clear size/reason and
one-tap confirm. Offer "fully autonomous" and "ask before each" as user preferences.

## Rationale
Best default experience: fast first run, no surprise multi-GB downloads, and heavy/hardware-specific
work happens exactly when a workflow needs it. Directly answers PoC friction F2/F3.

## Consequences
- Positive: fast onboarding; predictable downloads; hardware-aware heavy installs.
- Negative: a brief pause at first use of a heavy capability (e.g. first transcription).
- Mitigations: pre-warm/offer heavy installs proactively when idle; clear progress + ETA.

## Revisit when
If most users always need the heavy tier immediately (then bias toward fully-autonomous default).
