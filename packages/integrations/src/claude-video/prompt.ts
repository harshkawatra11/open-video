/**
 * OpenVideo — claude-video prompt construction + response parsing (doc 25 §2). Pure functions, fully
 * offline-testable: we never guess at the real Claude CLI's vision behavior in a unit test, only that
 * we build the request correctly and parse a well-formed (or malformed) response correctly.
 */

import type { Keyframe } from "./keyframes.ts";
import type { FootageAnalysis } from "./types.ts";

export interface BuildAnalysisPromptOptions {
  sourceId: string;
  keyframes: Keyframe[];
  transcript?: string;
}

const SCHEMA_HINT = `{
  "sourceId": string,
  "frameCount": number,
  "shots": [{ "startS": number, "endS": number, "shotType": "wide"|"medium"|"close-up"|"extreme-close-up"|"unknown", "energy": number (0-1), "subjects": string[], "onScreenText"?: string[], "usable": boolean, "note"?: string }],
  "brollOpportunities": [{ "atS": number, "reason": string, "suggestedTags": string[] }],
  "suggestedHookInS": number[],
  "deadRangesS": [[number, number]]
}`;

/** Builds the one-shot analysis prompt: references each extracted keyframe by absolute path (Claude
 *  Code's Read tool can view images) alongside its real timestamp, plus the transcript if we have
 *  one, and asks for strict JSON matching FootageAnalysis (no prose, no markdown fence). */
export function buildAnalysisPrompt(opts: BuildAnalysisPromptOptions): string {
  const frameLines = opts.keyframes.map((k, i) => `${i + 1}. t=${k.atS.toFixed(2)}s — ${k.path}`).join("\n");
  const transcriptBlock = opts.transcript
    ? `\n\nTranscript:\n${opts.transcript}`
    : "\n\n(No transcript available for this clip.)";
  return [
    `You are the OpenVideo Footage-Analysis agent. Read each of the following ${opts.keyframes.length} keyframes`,
    `extracted from source "${opts.sourceId}" (in order, with their real timestamp in the source):`,
    frameLines,
    transcriptBlock,
    "",
    "Analyze the footage: shot types and energy, subjects and on-screen text per shot, which ranges are",
    "usable vs. dead/static, good b-roll insertion points, and the best hook in-points for a short-form",
    "cut. Respond with ONLY a single JSON object (no markdown fence, no prose) matching this shape:",
    SCHEMA_HINT,
  ].join("\n");
}

export class FootageAnalysisParseError extends Error {}

/** Extracts the first top-level JSON object from a (possibly chatty) model response and validates
 *  its shape against FootageAnalysis at a structural level. */
export function parseFootageAnalysisResponse(text: string, sourceId: string, frameCount: number): FootageAnalysis {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new FootageAnalysisParseError("no JSON object found in the model response");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    throw new FootageAnalysisParseError(`invalid JSON in model response: ${(e as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Record<string, unknown>).shots)) {
    throw new FootageAnalysisParseError("model response JSON is missing a shots[] array");
  }
  const p = parsed as Partial<FootageAnalysis>;
  return {
    sourceId: p.sourceId ?? sourceId,
    frameCount: p.frameCount ?? frameCount,
    shots: p.shots ?? [],
    brollOpportunities: p.brollOpportunities ?? [],
    suggestedHookInS: p.suggestedHookInS ?? [],
    deadRangesS: p.deadRangesS ?? [],
  };
}
