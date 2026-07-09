/**
 * @openvideo/cli-adapter — the single point of coupling to the Claude CLI (ADR-0002, Appendix C).
 * Swap the backend here (e.g. to the Claude Agent SDK) without changing callers.
 */

export { parseClaudeEvent, normalizeToolName } from "./parse.ts";
export { buildClaudeArgs, createLineBuffer, spawnClaude, resolveClaudeBin, CLAUDE_BIN } from "./spawn.ts";
export type { SpawnOptions, ResolvedBin } from "./spawn.ts";
