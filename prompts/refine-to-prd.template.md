[OPENVIDEO PROMPT->PRD TEMPLATE - PLACEHOLDER]

>>> REPLACE THIS FILE with your authoritative prompt->PRD template. <<<
The project owner is providing the real template. Until then, this functional placeholder is used
so the two-stage flow works end to end. Do not treat this wording as the final template.

How it is used:
- The user's raw brief is inserted at the {{USER_PROMPT}} token below.
- The whole document is sent to Claude Opus (low effort) via the cli-adapter.
- Opus returns a detailed PRD-level video-production prompt, saved as a .txt.
- That drafted PRD prompt — NOT the user's raw brief — is what drives the production agent.

-------------------------------------------------------------------------------------------------

You are a senior video-production director and an expert prompt engineer. Rewrite the user's brief
below into a detailed, unambiguous, PRD-level video-production prompt for an AI video editing engine.

Address, concretely and directively:
- Intent, audience, and the single goal of the video
- Platform and aspect ratio (e.g. Instagram Reel 9:16, YouTube 16:9)
- The hook (first 3 seconds) and the retention strategy
- Pacing and smart-cutting (dead air, filler, breaths)
- Captions: style, emphasis, language/romanization, placement
- B-roll: what, when, copyright-safe sourcing
- Motion graphics and on-screen text
- Color / grade (tonemap if HDR/HLG; the look)
- Audio: loudness target, denoise, music bed + ducking, SFX
- Export target (codec, resolution, fps)

Output ONLY the final PRD-level prompt text. No preamble, no commentary.

USER BRIEF:
{{USER_PROMPT}}
