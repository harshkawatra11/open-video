# ADR-0002: Spawn the Claude CLI headless as the agent backbone

- **Status:** Accepted
- **Related:** PRD §8.4, §9, §16, §30.2; Appendix C

## Context
The product's intelligence is Claude. We must decide how to drive it. The user explicitly framed
this as "based only on the Claude CLI" and runs Claude Code on a Pro subscription. open-design
spawns coding-agent CLIs as child processes. Two integration mechanisms are viable: spawn the CLI
binary, or use the Claude Agent SDK (the same engine as a library).

## Options considered
1. **Spawn the Claude CLI headless** (`claude -p "…" --output-format stream-json --input-format
   stream-json --resume <id>`) and parse the event stream. Reuses the user's subscription auth,
   plus the CLI's subagents, skills, MCP, plan mode, permission modes, and usage surface.
   Con: parse stream-json; the CLI is a moving target.
2. **Claude Agent SDK (library)** — type-safe, in-process, same harness. Con: typically API-key
   billed (per-token cost); does not reuse the user's existing Claude entitlement by default.
3. **Agent-agnostic adapter (any CLI)** — max flexibility/OSS appeal. Con: largest surface, hardest
   to make reliable.
4. **Custom loop on the raw Messages API** — total control. Con: rebuild subagents/MCP/permissions/
   compaction we'd otherwise get for free.

## Decision
**Spawn the Claude CLI headless** as the v1 backbone, behind a thin **versioned `cli-adapter`**
package that isolates the rest of the codebase from CLI flag/event changes. Document the **Agent
SDK** as the supported alternative for API-keyed/headless-server deployments.

## Rationale
Reuses the user's Claude subscription (decisive cost/adoption win), inherits the full CLI feature
set, and is the most literal fit to the user's steer. The adapter contains the "moving target"
risk in one place.

## Consequences
- Positive: no per-token bill for the default user; full CLI features; fast to build.
- Negative: stream-json parsing; coupling to CLI behavior; auth tied to the CLI.
- Mitigations: the `cli-adapter` contract + smoke tests (Appendix C); pin a known-good CLI version;
  the Agent SDK alternative is documented for environments that need it.

## Revisit when
The CLI's headless contract changes materially, or a deployment needs in-process/API-key operation
as the default (switch the adapter's backend to the SDK).
