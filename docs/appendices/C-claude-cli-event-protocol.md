# Appendix C — Claude CLI event protocol & adapter contract

OpenVideo drives Claude by spawning the **Claude CLI headless** (ADR-0002). All coupling to the CLI
is isolated in one package, `packages/cli-adapter`, so CLI changes never ripple through the codebase.

> The exact flags and event field names below should be confirmed against the installed CLI version
> at integration time (the adapter pins a known-good version and ships smoke tests). This document
> specifies the *contract* the adapter must satisfy, not a frozen CLI spec.

---

## 1. Spawning a session
```
claude -p "<prompt>" \
  --output-format stream-json \
  --input-format  stream-json \
  --model <claude-opus-4-8 | claude-sonnet-4-6 | claude-haiku-4-5> \
  [--resume <sessionId>] \
  [--mcp-config <path-to-openvideo-mcp.json>] \
  [permission/effort/plan-mode flags]
```
- One CLI child process per active cockpit conversation.
- `--resume <sessionId>` continues a prior session; the daemon stores the session id per project.
- The OpenVideo MCP server (PRD §8.6) is registered via the MCP config so the CLI's agents can call
  the media tools.
- Models/effort/mode come from the cockpit control surface (PRD §18.2).

## 2. Input (to the CLI)
The daemon writes stream-json input events: the user message/intent, tool results (when the daemon
executes a client-side tool), and control signals (interrupt). The prompt is assembled in a
cache-friendly order (PRD §16.3): frozen system prompt → STYLE.md → sorted tool list → EDD/analysis
summaries → the user's latest intent.

## 3. Output (from the CLI) — event stream the adapter consumes
The adapter parses the stream-json events and normalizes them to OpenVideo events:

| CLI event (conceptual) | Carries | Normalized to | Cockpit/terminal effect |
|------------------------|---------|---------------|--------------------------|
| message/thinking start | — | `agent.thinking` | "Thinking…" |
| text delta | partial text | `agent.message` | streamed assistant text |
| tool_use | tool name + input | `agent.tool_use` | "Running &lt;tool&gt;…" / friendly line |
| tool_result | output / error | `agent.tool_result` | progress / result |
| usage | tokens (in/out/cache) | `usage.delta` | usage + limit meter (PRD §22.8) |
| result / stop | stop reason, final | `agent.result` | turn complete |
| error | message | `agent.error` | translated error + details disclosure |

(See PRD §19.2 for the full event → terminal-line mapping.)

## 4. Tool calls
- High-value/privileged capabilities are **dedicated MCP tools** (probe, transcribe, tonemap_grade,
  level_audio, edd_apply_patch, edd_render, remotion_render, ffmpeg_compose, fetch_media…), so the
  daemon can gate, validate, and audit them.
- A constrained bash tool MAY exist for breadth, but hard-to-reverse actions are promoted to gated
  tools (the agent-design principle).

## 5. Sessions, plan mode, permissions
- **Plan mode:** the Director proposes a blueprint and waits; the cockpit renders Approve/Amend/
  Reject. Maps to the CLI's plan/permission flags.
- **Auto mode:** bounded autonomy; gated actions still prompt.
- **Interrupt:** the daemon can interrupt a running session at a safe boundary.

## 6. Usage & limits
- The adapter aggregates `usage` events per session and against the user's Claude plan, feeding the
  live usage/limit meter and the "approaching limit" warning (PRD §18.3, §22.8).

## 7. Adapter responsibilities (the contract)
1. **Spawn/lifecycle:** start/resume/interrupt/kill CLI processes; one per session; clean teardown.
2. **Encode/decode:** write stream-json input; parse stream-json output into normalized events.
3. **Version isolation:** pin a known-good CLI version; detect mismatches; map across minor changes;
   fail loudly on incompatible majors.
4. **Auth passthrough:** rely on the CLI's own subscription auth; never store Claude credentials.
5. **Backpressure & ordering:** preserve event order; stream incrementally; handle partials.
6. **Errors:** classify (transient/fatal), surface precise diagnostics, support retry.
7. **Smoke tests:** a CI suite that spawns the CLI on a trivial prompt and asserts the event shapes,
   so CLI drift is caught before release.

## 8. Alternative backend (documented)
The adapter is written so its backend can be swapped to the **Claude Agent SDK** (in-process,
API-keyed) for headless-server or API-billed deployments, without changing callers (ADR-0002).
