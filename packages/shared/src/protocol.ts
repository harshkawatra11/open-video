/**
 * OpenVideo — the Edit/Session protocol (PRD §8.7, Appendix D §10).
 *
 * The documented cockpit <-> daemon contract. Requests flow cockpit -> daemon (loopback HTTP);
 * Events flow daemon -> cockpit (SSE). Both are discriminated unions on `type`.
 *
 * Erasable TypeScript (types + small const tables only).
 */

import type { Diagnostic } from "@openvideo/edd";

export type ModelId = "claude-opus-4-8" | "claude-sonnet-4-6" | "claude-haiku-4-5";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type Mode = "plan" | "auto";

export interface ControlSettings {
  model: ModelId;
  effort: Effort;
  mode: Mode;
}

/** Requests: cockpit -> daemon. */
export type Request =
  | { type: "session.start"; projectId: string; control: ControlSettings }
  | { type: "session.resume"; sessionId: string }
  | { type: "session.interrupt"; sessionId: string }
  | { type: "intent.submit"; sessionId: string; text: string }
  | { type: "plan.approve"; sessionId: string; planId: string }
  | { type: "plan.amend"; sessionId: string; planId: string; text: string }
  | { type: "plan.reject"; sessionId: string; planId: string }
  | { type: "edd.get"; projectId: string }
  | { type: "edd.patch"; projectId: string; patch: unknown }
  | { type: "edd.history"; projectId: string }
  | { type: "render.request"; projectId: string; quality: "preview" | "final"; range?: [number, number] }
  | { type: "render.cancel"; jobId: string }
  | { type: "install.approve"; capability: string }
  | { type: "control.set"; sessionId: string; control: Partial<ControlSettings> };

/** Events: daemon -> cockpit (SSE). */
export type Event =
  | { type: "agent.thinking"; sessionId: string }
  | { type: "agent.message"; sessionId: string; text: string }
  | { type: "agent.tool_use"; sessionId: string; tool: string }
  | { type: "agent.tool_result"; sessionId: string; tool: string; ok: boolean }
  | { type: "agent.result"; sessionId: string }
  | { type: "agent.error"; sessionId: string; message: string }
  | { type: "plan.proposed"; sessionId: string; planId: string; blueprint: unknown }
  | { type: "edd.changed"; projectId: string; diagnostics: Diagnostic[] }
  | { type: "render.progress"; jobId: string; phase: string; percent: number; etaS?: number }
  | { type: "render.done"; jobId: string; output: string }
  | { type: "usage.delta"; sessionId: string; inputTokens: number; outputTokens: number; cacheReadTokens: number }
  | { type: "install.status"; capability: string; phase: string; percent: number };

export type ProtocolMessage = Request | Event;

const EVENT_TYPES: ReadonlySet<string> = new Set<Event["type"]>([
  "agent.thinking",
  "agent.message",
  "agent.tool_use",
  "agent.tool_result",
  "agent.result",
  "agent.error",
  "plan.proposed",
  "edd.changed",
  "render.progress",
  "render.done",
  "usage.delta",
  "install.status",
]);

export function isEvent(m: ProtocolMessage): m is Event {
  return EVENT_TYPES.has(m.type);
}
export function isRequest(m: ProtocolMessage): m is Request {
  return !EVENT_TYPES.has(m.type);
}
