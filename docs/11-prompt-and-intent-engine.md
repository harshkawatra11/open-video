# 11 — Prompt & Intent Engine

> Expands PRD §16. Turns utterances into typed intents and well-formed, cache-friendly Claude CLI
> sessions. CLI protocol: Appendix C.

## Intent taxonomy
Families: `create transform analyze captions broll audio hook export style project system`. Each has
a parameter schema and maps to a Director playbook (which agents, in what order). Examples:
- "Turn this into a premium reel" → `create{platform:instagram_reel}`
- "Find every dead frame" → `analyze{kind:dead_air}` then `transform{pacing}`
- "Make it feel like Hormozi" → `style{ref:hormozi}` (look system + pacing/caption presets)
- "Add agency captions" → `captions{style:premium, wordLevel:true, emphasis:true}`
- "Prepare my machine" → `system{install}`

## Parsing & resolution
Resolve context ("this clip" → active asset; "the hook" → current EDD opening; "shorter" → duration
constraint on the current timeline). Extract params (platform, style ref, duration, language).
Ambiguity that materially changes output → one focused clarifying question in plan mode, not a guess.

## Prompt construction (cache-friendly — PRD §22.8)
Stable→volatile order: (1) frozen system prompt; (2) `STYLE.md`; (3) sorted MCP tool list; (4) EDD +
analysis summaries; (5) the user's latest intent. Subagents receive only their slice.

## Claude CLI invocation
`claude -p "<prompt>" --output-format stream-json --input-format stream-json [--resume <id>]
[--model …] [effort/permission flags] [--mcp-config …]`. Events (thinking/tool_use/tool_result/
usage/result) parsed by `packages/cli-adapter` and mapped to cockpit/terminal events (Appendix C;
PRD §19.2). A versioned adapter isolates the codebase from CLI changes.

## Plan / auto / permissions
Plan mode = propose blueprint, await approval (default for large ops; PoC blueprint step). Auto mode =
bounded autonomy. Permission system gates hard-to-reverse actions (overwrite/delete/import/install)
with inline cockpit prompts.

## Memory
Session (CLI transcript, compacted) · Project (`memory/*.md`) · Artifact (versioned EDD/plan/
transcript). Director consults project memory for cross-session consistency.

## Cost & effort
Model+effort user-set (control surface) + per-agent-defaulted (PRD §9.9). Prompt caching, cheap
subagents, bounded turns/effort, and a live usage/limit meter keep cost visible and controlled.
