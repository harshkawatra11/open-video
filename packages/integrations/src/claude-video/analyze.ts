/**
 * OpenVideo — claude-video: analyze(video, opts) → FootageAnalysis (doc 25 §2). Orchestrates our own
 * ffmpeg keyframe extraction + Claude vision (via the cli-adapter, one-shot) + response validation.
 * The MCP tool `analyze_footage` and the daemon route are thin wrappers around this.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnClaude } from "@openvideo/cli-adapter";
import type { ModelId } from "@openvideo/shared";
import { extractKeyframes, type KeyframeOptions } from "./keyframes.ts";
import { buildAnalysisPrompt } from "./prompt.ts";
import { parseFootageAnalysisResponse } from "./prompt.ts";
import type { FootageAnalysis } from "./types.ts";

export interface AnalyzeFootageOptions extends KeyframeOptions {
  sourceId: string;
  transcript?: string;
  model?: ModelId;
  effort?: string;
  /** Where to extract keyframes + cache the result (typically project/cache/footage-analysis/<id>). */
  cacheDir: string;
}

/** Consumes the spawnClaude event stream and concatenates every assistant message into one string —
 *  the final answer text we parse JSON out of. */
async function collectAssistantText(gen: AsyncGenerator<import("@openvideo/shared").Event>): Promise<string> {
  let text = "";
  for await (const ev of gen) {
    if (ev.type === "agent.message") text += ev.text;
    if (ev.type === "agent.error") throw new Error(`claude-video: agent error — ${ev.message}`);
  }
  return text;
}

/** Runs the full footage vision-analysis pipeline. Real ffmpeg + real Claude CLI spawn — exercised as
 *  an integration path (like the render executor), not in offline unit tests. */
export async function analyzeFootage(videoPath: string, opts: AnalyzeFootageOptions): Promise<FootageAnalysis> {
  const cachePath = path.join(opts.cacheDir, `${opts.sourceId}.footage-analysis.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8")) as FootageAnalysis;
  }

  const framesDir = path.join(opts.cacheDir, "frames", opts.sourceId);
  const keyframes = await extractKeyframes(videoPath, framesDir, opts);
  const prompt = buildAnalysisPrompt({ sourceId: opts.sourceId, keyframes, transcript: opts.transcript });

  const text = await collectAssistantText(
    spawnClaude({
      prompt,
      model: opts.model ?? "claude-opus-4-8",
      effort: opts.effort ?? "high",
    }),
  );

  const analysis = parseFootageAnalysisResponse(text, opts.sourceId, keyframes.length);
  fs.mkdirSync(opts.cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(analysis, null, 2));
  return analysis;
}
