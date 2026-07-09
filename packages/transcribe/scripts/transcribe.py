#!/usr/bin/env python3
"""
OpenVideo — faster-whisper transcription wrapper (doc 06 heavy tier, PRD §11).

Deliberately a small, bundled Python script rather than a package: faster-whisper has no official
CLI, so this is the thinnest possible wrapper that (a) loads a model, (b) transcribes with
word-level timestamps, and (c) writes a flat JSON array of {word, start, end} to --output — a shape
packages/transcribe/src/transcribe.ts parses back into EDD Word[]. Never invoked directly by agents
(CLAUDE.md invariant 5); only spawned by the daemon/transcribe package, which the Installer gates
behind the heavy tier (ADR-0004).
"""

import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe audio/video with word-level timestamps.")
    parser.add_argument("input", help="path to the audio/video file")
    parser.add_argument("--output", required=True, help="path to write the word-timing JSON")
    parser.add_argument("--model", default="base", help="faster-whisper model size (default: base)")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], help="inference device")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            json.dumps({"error": "faster-whisper is not installed — approve the heavy-tier install first."}),
            file=sys.stderr,
        )
        return 2

    compute_type = "float16" if args.device == "cuda" else "int8"
    model = WhisperModel(args.model, device=args.device, compute_type=compute_type)

    segments, _info = model.transcribe(args.input, word_timestamps=True)

    words = []
    for segment in segments:
        for w in segment.words or []:
            words.append({"word": w.word.strip(), "start": w.start, "end": w.end})

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(words, f)

    return 0


if __name__ == "__main__":
    sys.exit(main())
