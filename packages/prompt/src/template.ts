/**
 * OpenVideo — prompt→PRD template handling (PRD §16 Intent Engine).
 *
 * Most users are not skilled prompt engineers, so a raw brief is first rewritten by Claude Opus
 * (low effort) into a detailed, unambiguous, PRD-level video-production prompt. That drafted PRD
 * prompt — not the raw user input — is the actual prompt handed to the production agent.
 *
 * The authoritative template is supplied by the project owner (set OPENVIDEO_PROMPT_TEMPLATE to a
 * file, or edit prompts/refine-to-prd.template.md). Until then a clearly-marked PLACEHOLDER is used.
 */

import fs from "node:fs";
import path from "node:path";

export const PLACEHOLDER_MARKER = "[OPENVIDEO PROMPT->PRD TEMPLATE - PLACEHOLDER]";

/** Functional placeholder so the feature works before the real template is provided. */
export const DEFAULT_REFINE_TEMPLATE = `${PLACEHOLDER_MARKER}
Replace this with the authoritative prompt->PRD template:
set OPENVIDEO_PROMPT_TEMPLATE to a file path, or edit prompts/refine-to-prd.template.md.

You are a senior video-production director and prompt engineer. Rewrite the user's brief below into
a detailed, unambiguous, PRD-level video-production prompt for an AI video editor. Cover: intent and
audience; platform and aspect ratio; the hook (first 3 seconds); pacing and smart-cutting; captions
(style, emphasis, language); b-roll; motion graphics; color/grade; audio (loudness, music, SFX);
and the export target. Be specific and directive. Output ONLY the final prompt text, no preamble.

USER BRIEF:
{{USER_PROMPT}}
`;

export interface LoadTemplateOptions {
  /** explicit template file path (e.g. from OPENVIDEO_PROMPT_TEMPLATE). */
  path?: string;
  /** repo/app root; looked up at <root>/prompts/refine-to-prd.template.md. */
  repoRoot?: string;
}

export interface LoadedTemplate {
  template: string;
  source: string;
  isPlaceholder: boolean;
}

export function loadRefineTemplate(opts: LoadTemplateOptions = {}): LoadedTemplate {
  if (opts.path && fs.existsSync(opts.path)) {
    const template = fs.readFileSync(opts.path, "utf8");
    return { template, source: opts.path, isPlaceholder: isPlaceholderTemplate(template) };
  }
  if (opts.repoRoot) {
    const p = path.join(opts.repoRoot, "prompts", "refine-to-prd.template.md");
    if (fs.existsSync(p)) {
      const template = fs.readFileSync(p, "utf8");
      return { template, source: p, isPlaceholder: isPlaceholderTemplate(template) };
    }
  }
  return { template: DEFAULT_REFINE_TEMPLATE, source: "(built-in placeholder)", isPlaceholder: true };
}

/** Insert the user's brief into the template ({{USER_PROMPT}} token, or appended if absent). */
export function buildRefineInput(template: string, userPrompt: string): string {
  if (template.includes("{{USER_PROMPT}}")) return template.replaceAll("{{USER_PROMPT}}", userPrompt);
  return `${template}\n\nUSER BRIEF:\n${userPrompt}\n`;
}

export function isPlaceholderTemplate(template: string): boolean {
  return template.includes(PLACEHOLDER_MARKER);
}
