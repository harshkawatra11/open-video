import test from "node:test";
import assert from "node:assert/strict";
import { parseClaudeEvent, normalizeToolName } from "../src/index.ts";

const SID = "sesn_1";

test("normalizeToolName strips the MCP prefix", () => {
  assert.equal(normalizeToolName("mcp__openvideo__transcribe"), "transcribe");
  assert.equal(normalizeToolName("Bash"), "Bash");
});

test("assistant text + tool_use + thinking map to protocol events", () => {
  const raw = {
    type: "assistant",
    session_id: SID,
    message: {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "..." },
        { type: "text", text: "Let me analyze the footage." },
        { type: "tool_use", id: "tu1", name: "mcp__openvideo__probe", input: {} },
      ],
      usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 80 },
    },
  };
  const events = parseClaudeEvent(raw, SID);
  assert.deepEqual(
    events.map((e) => e.type),
    ["agent.thinking", "agent.message", "agent.tool_use", "usage.delta"],
  );
  const toolUse = events.find((e) => e.type === "agent.tool_use")!;
  assert.equal((toolUse as { tool: string }).tool, "probe");
  const usage = events.find((e) => e.type === "usage.delta")! as { cacheReadTokens: number };
  assert.equal(usage.cacheReadTokens, 80);
});

test("tool_result resolves back to the tool's name via a shared toolNames map, not the opaque tool_use_id", () => {
  const toolNames = new Map<string, string>();
  const assistantRaw = {
    type: "assistant",
    message: { role: "assistant", content: [{ type: "tool_use", id: "tu1", name: "Bash", input: {} }] },
  };
  parseClaudeEvent(assistantRaw, SID, toolNames);

  const userRaw = {
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", is_error: false, content: "ok" }] },
  };
  const events = parseClaudeEvent(userRaw, SID, toolNames);
  assert.equal((events[0] as { tool: string }).tool, "Bash");
});

test("tool_result falls back to the raw id when no toolNames map is supplied or the id is unseen", () => {
  const raw = {
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu_unseen", is_error: false, content: "ok" }] },
  };
  const events = parseClaudeEvent(raw, SID);
  assert.equal((events[0] as { tool: string }).tool, "tu_unseen");
});

test("user tool_result maps to agent.tool_result with ok flag", () => {
  const raw = {
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", is_error: false, content: "ok" }] },
  };
  const events = parseClaudeEvent(raw, SID);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "agent.tool_result");
  assert.equal((events[0] as { ok: boolean }).ok, true);
});

test("result emits usage.delta + agent.result; error subtype emits agent.error", () => {
  const ok = parseClaudeEvent(
    { type: "result", subtype: "success", result: "done", usage: { input_tokens: 5, output_tokens: 3 } },
    SID,
  );
  assert.deepEqual(ok.map((e) => e.type), ["usage.delta", "agent.result"]);

  const bad = parseClaudeEvent({ type: "result", subtype: "error", result: "boom" }, SID);
  assert.ok(bad.some((e) => e.type === "agent.error"));
});

test("system/init and unknown lines produce no events", () => {
  assert.deepEqual(parseClaudeEvent({ type: "system", subtype: "init" }, SID), []);
  assert.deepEqual(parseClaudeEvent({ type: "mystery" }, SID), []);
  assert.deepEqual(parseClaudeEvent("not an object", SID), []);
});
