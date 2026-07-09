/**
 * OpenVideo — transcribe(): faster-whisper word-level timings (doc 06 heavy tier, PRD §11). Spawns
 * `scripts/transcribe.py` (bundled with this package) via a real Python interpreter. Honest failure
 * modes rather than silent no-ops — matches the VOID adapter's pattern for heavy/tiered integrations:
 * report exactly what's missing (Python itself, or the faster-whisper package) so the Installer/user
 * knows what to approve, never fabricate a transcript.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Word } from "@openvideo/edd";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(HERE, "../scripts/transcribe.py");

export class PythonNotFoundError extends Error {
  constructor() {
    super("No Python interpreter found on PATH — transcription needs Python (installer heavy tier).");
    this.name = "PythonNotFoundError";
  }
}

export class FasterWhisperNotInstalledError extends Error {
  constructor() {
    super("faster-whisper is not installed — approve the heavy-tier install first (Settings → Installer).");
    this.name = "FasterWhisperNotInstalledError";
  }
}

/** Resolves a real Python interpreter. Unlike the Claude CLI (a globally-installed system binary
 *  wrapped in an npm-style shim), `python`/`python3`/`py` on Windows are native PE executables
 *  themselves — no shim-following needed, just a plain PATH scan preferring `.exe` (mirrors the same
 *  extension-order fix applied elsewhere in this repo). */
export function resolvePythonBin(candidates: string[] = ["python", "python3", "py"]): string | undefined {
  const override = process.env.OPENVIDEO_PYTHON_BIN;
  if (override && existsSync(override)) return override;

  const exts = process.platform === "win32" ? [".exe", ""] : [""];
  for (const name of candidates) {
    if (path.isAbsolute(name) && existsSync(name)) return name;
    for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
      for (const ext of exts) {
        const candidate = path.join(dir, name + ext);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

export interface TranscribeOptions {
  /** faster-whisper model size, e.g. "tiny" | "base" | "small" | "medium" | "large-v3". */
  model?: string;
  device?: "cpu" | "cuda";
}

/** Raw shape written by scripts/transcribe.py. */
export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

/** Pure: converts the script's raw word list into EDD Word[] (doc 10 caption track shape). Emphasis
 *  is left false here — that's the Caption agent's editorial call, not the transcription tool's. */
export function toEddWords(raw: WhisperWord[]): Word[] {
  return raw.map((w) => ({ t: w.word, startS: w.start, endS: w.end, emph: false }));
}

export function buildTranscribeArgs(inputPath: string, outputPath: string, opts: TranscribeOptions = {}): string[] {
  const args = [SCRIPT_PATH, inputPath, "--output", outputPath];
  if (opts.model) args.push("--model", opts.model);
  if (opts.device) args.push("--device", opts.device);
  return args;
}

/** Runs the real transcription pipeline end to end. Integration-level (spawns Python + faster-
 *  whisper) — not exercised in offline unit tests, same convention as every other real-binary path
 *  in this repo (render's execute.int.test.ts, the VOID/claude-video adapters). */
export async function transcribe(inputPath: string, opts: TranscribeOptions = {}): Promise<Word[]> {
  const python = resolvePythonBin();
  if (!python) throw new PythonNotFoundError();

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "openvideo-transcribe-"));
  const outputPath = path.join(tmpDir, "words.json");
  const args = buildTranscribeArgs(inputPath, outputPath, opts);

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(python, args, { windowsHide: true });
      let stderr = "";
      child.stderr?.on("data", (d) => {
        stderr += String(d);
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 2 || /faster-whisper is not installed/.test(stderr)) {
          return reject(new FasterWhisperNotInstalledError());
        }
        if (code !== 0) return reject(new Error(`transcribe.py exited ${code}: ${stderr.slice(-800)}`));
        resolve();
      });
    });
    const raw = JSON.parse(readFileSync(outputPath, "utf8")) as WhisperWord[];
    return toEddWords(raw);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
