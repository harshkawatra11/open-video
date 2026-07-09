/**
 * OpenVideo — Claude CLI stream-json -> Edit/Session protocol Events (Appendix C §3).
 *
 * Defensive on purpose: the CLI's exact field names can shift across versions, and this adapter is
 * the single place that absorbs that. Unknown shapes map to nothing rather than throwing. Confirm
 * shapes against the installed CLI via the adapter smoke tests (Appendix C §7).
 */

import type { Event } from "@openvideo/shared";

/** Strip an MCP tool prefix: "mcp__openvideo__transcribe" -> "transcribe". */
export function normalizeToolName(name: string): string {
  const parts = name.split("__");
  return parts[0] === "mcp" && parts.length >= 3 ? parts.slice(2).join("__") : name;
}

function num(o: Record<string, unknown>, k: string): number {
  const v = o[k];
  return typeof v === "number" ? v : 0;
}

function usageEvent(u: Record<string, unknown>, sessionId: string): Event {
  return {
    type: "usage.delta",
    sessionId,
    inputTokens: num(u, "input_tokens"),
    outputTokens: num(u, "output_tokens"),
    cacheReadTokens: num(u, "cache_read_input_tokens"),
  };
}

function parseAssistant(r: Record<string, unknown>, sessionId: string): Event[] {
  const out: Event[] = [];
  const msg = r.message as Record<string, unknown> | undefined;
  const content = Array.isArray(msg?.content) ? (msg!.content as Record<string, unknown>[]) : [];
  for (const b of content) {
    if (b.type === "text" && typeof b.text === "string" && b.text.length > 0) {
      out.push({ type: "agent.message", sessionId, text: b.text });
    } else if (b.type === "thinking") {
      out.push({ type: "agent.thinking", sessionId });
    } else if (b.type === "tool_use" && typeof b.name === "string") {
      out.push({ type: "agent.tool_use", sessionId, tool: normalizeToolName(b.name) });
    }
  }
  const usage = msg?.usage as Record<string, unknown> | undefined;
  if (usage) out.push(usageEvent(usage, sessionId));
  return out;
}

function parseUser(r: Record<string, unknown>, sessionId: string): Event[] {
  const msg = r.message as Record<string, unknown> | undefined;
  const content = Array.isArray(msg?.content) ? (msg!.content as Record<string, unknown>[]) : [];
  const out: Event[] = [];
  for (const b of content) {
    if (b.type === "tool_result") {
      out.push({
        type: "agent.tool_result",
        sessionId,
        tool: typeof b.tool_use_id === "string" ? b.tool_use_id : "",
        ok: b.is_error !== true,
      });
    }
  }
  return out;
}

function parseResult(r: Record<string, unknown>, sessionId: string): Event[] {
  const out: Event[] = [];
  const usage = r.usage as Record<string, unknown> | undefined;
  if (usage) out.push(usageEvent(usage, sessionId));
  if (r.subtype === "error" || r.is_error === true) {
    out.push({ type: "agent.error", sessionId, message: String(r.result ?? r.error ?? "error") });
  } else {
    out.push({ type: "agent.result", sessionId });
  }
  return out;
}

/** Map one parsed stream-json object to zero or more protocol Events. */
export function parseClaudeEvent(raw: unknown, sessionId: string): Event[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case "assistant":
      return parseAssistant(r, sessionId);
    case "user":
      return parseUser(r, sessionId);
    case "result":
      return parseResult(r, sessionId);
    case "error":
      return [{ type: "agent.error", sessionId, message: String(r.error ?? r.message ?? "unknown error") }];
    case "system":
    default:
      return [];
  }
}
