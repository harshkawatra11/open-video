/**
 * OpenVideo — the "alive" terminal mapping (PRD §19.2).
 *
 * Maps daemon/agent Events to human-legible status lines. The cockpit renders these in the alive
 * layer; the raw layer shows the underlying tool activity on demand.
 */

import type { Event } from "./protocol.ts";

/** MCP tool name -> friendly status line (legacy Director/MCP path, parked per ADR-0014). */
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

/** Claude Code's own tool name -> friendly status line (thin-agent-wrapper path, ADR-0014). A
 *  scaffolded workspace session uses Bash/Write/Edit/Read directly instead of MCP tools, so these
 *  need their own mapping; unrecognized names fall through to the generic "Running X..." line. */
const CLI_TOOL_LINE: Record<string, string> = {
  Bash: "Running a command...",
  PowerShell: "Running a command...",
  Write: "Writing a file...",
  Edit: "Editing a file...",
  Read: "Reading a file...",
  Glob: "Finding files...",
  Grep: "Searching files...",
};

/** Friendly status line for a tool name, checking both the CLI's own tools (Bash/Write/...) and
 *  the legacy MCP tool names, falling back to a generic "Running X..." line. */
export function friendlyToolLine(tool: string): string {
  return CLI_TOOL_LINE[tool] ?? TOOL_LINE[tool] ?? `Running ${tool}...`;
}

/**
 * Friendly terminal line for an event, or null if the event has no alive-layer representation
 * (e.g. usage deltas, which drive the meter rather than the terminal).
 */
export function friendlyTerminalLine(ev: Event): string | null {
  switch (ev.type) {
    case "agent.thinking":
      return "Thinking...";
    case "agent.tool_use":
      return friendlyToolLine(ev.tool);
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
