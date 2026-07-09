/**
 * OpenVideo — the "alive" terminal mapping (PRD §19.2).
 *
 * Maps daemon/agent Events to human-legible status lines. The cockpit renders these in the alive
 * layer; the raw layer shows the underlying tool activity on demand.
 */

import type { Event } from "./protocol.ts";

/** MCP tool name -> friendly status line. */
const TOOL_LINE: Record<string, string> = {
  probe: "Analyzing footage...",
  extract_audio: "Extracting audio...",
  transcribe: "Building transcript...",
  detect_silence: "Detecting silence...",
  detect_cuts: "Finding jump cuts...",
  tonemap_grade: "Grading color...",
  level_audio: "Optimizing audio...",
  edd_apply_patch: "Generating timeline...",
  edd_render: "Rendering preview...",
  remotion_render: "Rendering captions...",
  ffmpeg_compose: "Running FFmpeg...",
  fetch_media: "Importing media...",
};

/**
 * Friendly terminal line for an event, or null if the event has no alive-layer representation
 * (e.g. usage deltas, which drive the meter rather than the terminal).
 */
export function friendlyTerminalLine(ev: Event): string | null {
  switch (ev.type) {
    case "agent.thinking":
      return "Thinking...";
    case "agent.tool_use":
      return TOOL_LINE[ev.tool] ?? `Running ${ev.tool}...`;
    case "agent.message":
      return ev.text;
    case "plan.proposed":
      return "Proposing a plan...";
    case "render.progress":
      return ev.etaS !== undefined
        ? `${ev.phase}... ${Math.round(ev.percent)}% (eta ${Math.round(ev.etaS)}s)`
        : `${ev.phase}... ${Math.round(ev.percent)}%`;
    case "render.done":
      return "Render complete.";
    case "agent.error":
      return `Error: ${ev.message}`;
    case "install.status":
      return `${ev.capability}: ${ev.phase} ${Math.round(ev.percent)}%`;
    case "agent.result":
    case "agent.tool_result":
    case "edd.changed":
    case "usage.delta":
      return null;
  }
}
