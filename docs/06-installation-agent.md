# 06 — Installation Agent

> Expands PRD §10. Tiered (ADR-0004), hardware-aware, verify/repair/rollback. The "superpowers
> before editing" layer. Windows-first (ADR-0007).

## Tiers
- **Core (auto, silent, first run):** ffmpeg, ffprobe, yt-dlp, node/pnpm, Remotion runtime. Small,
  universally needed.
- **Heavy (first use, one-tap confirm):** bundled Python+torch toolchain, Whisper/faster-whisper +
  model weights (~1.5 GB+), CUDA/cuDNN (if NVIDIA), optional model packs, large fonts/codecs. Shows
  size + reason before downloading.

## Hardware/OS detection (cached profile)
OS+version+arch; CPU (cores/features); RAM; free disk; GPU (vendor/model/CUDA/driver; later
Metal/VAAPI); existing tools+versions on PATH; available package managers (winget/choco). Drives
every install decision (e.g. CUDA torch only if a supported NVIDIA GPU + driver is present).

## Per-dependency lifecycle
`detect → plan (method + pinned version + size; heavy: confirm) → install (captured output, timeout,
progress) → configure (PATH user-scope; env e.g. PYTHONUTF8=1; project-local paths) → verify
(capability smoke test, not just "binary exists") → repair (reinstall on corruption/duplication —
the PoC saw a doubled ffmpeg in the Remotion compositor) → rollback (restore prior state on failure)
→ report (capability report to the cockpit)`. Idempotent: re-running is a safe no-op when healthy.

## Windows-first specifics (from PoC)
- Prefer winget → choco → bundle.
- PATH edits user-scoped + the daemon resolves tool paths directly (not relying solely on inherited
  PATH).
- `PYTHONUTF8=1` to avoid the cp1252 console crash on multilingual output.
- Bundle a pinned Python + torch (system Python 3.14 lacked CUDA wheels in the PoC).
- Health-check the Remotion native compositor; default to the PNG-sequence + FFmpeg path when
  unhealthy (ADR-0006).

## GPU/CUDA strategy
NVIDIA + driver detected → CUDA torch (+ runtime) for 30–50× faster ASR and NVENC encode; else CPU
torch + libx264 (always works), with the trade-off stated and GPU enablement offered. Never silently
trap the user in a 40-minute CPU transcription.

## UX
Structured progress (phase/%/ETA/action) in the "alive" terminal + an install panel; heavy downloads
show size+reason+one-tap; failures show precise diagnostics + rollback result; a "doctor" command
re-profiles and self-heals (PRD §25.5).

## Upgrades & pinning
Versions pinned per release; deliberate, verified upgrades with rollback safety; outdated-tool
detection.

## Plugin dependencies
Plugins declare deps in their manifest; the agent provisions them on the same tiered, verified basis.
