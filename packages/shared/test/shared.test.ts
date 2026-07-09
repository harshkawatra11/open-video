import test from "node:test";
import assert from "node:assert/strict";
import { newId, hasPrefix, isEvent, isRequest, friendlyTerminalLine } from "../src/index.ts";
import type { Event, Request } from "../src/protocol.ts";

test("newId produces prefixed unique ids", () => {
  const a = newId("sesn");
  const b = newId("sesn");
  assert.ok(a.startsWith("sesn_"));
  assert.ok(hasPrefix(a, "sesn"));
  assert.notEqual(a, b);
});

test("isEvent / isRequest discriminate the protocol", () => {
  const ev: Event = { type: "agent.thinking", sessionId: "s1" };
  const rq: Request = { type: "intent.submit", sessionId: "s1", text: "make a reel" };
  assert.equal(isEvent(ev), true);
  assert.equal(isRequest(ev), false);
  assert.equal(isRequest(rq), true);
  assert.equal(isEvent(rq), false);
});

test("friendlyTerminalLine maps tool use to alive-layer lines (PRD §19.2)", () => {
  assert.equal(friendlyTerminalLine({ type: "agent.thinking", sessionId: "s" }), "Thinking...");
  assert.equal(
    friendlyTerminalLine({ type: "agent.tool_use", sessionId: "s", tool: "transcribe" }),
    "Building transcript...",
  );
  assert.equal(
    friendlyTerminalLine({ type: "agent.tool_use", sessionId: "s", tool: "detect_cuts" }),
    "Finding jump cuts...",
  );
  // unknown tool falls back gracefully
  assert.equal(
    friendlyTerminalLine({ type: "agent.tool_use", sessionId: "s", tool: "mystery" }),
    "Running mystery...",
  );
});

test("friendlyTerminalLine returns null for meter-only events", () => {
  assert.equal(
    friendlyTerminalLine({ type: "usage.delta", sessionId: "s", inputTokens: 1, outputTokens: 2, cacheReadTokens: 0 }),
    null,
  );
});

test("render.progress line includes phase, percent and eta", () => {
  const line = friendlyTerminalLine({ type: "render.progress", jobId: "j", phase: "Compositing", percent: 42.4, etaS: 12.6 });
  assert.equal(line, "Compositing... 42% (eta 13s)");
});
