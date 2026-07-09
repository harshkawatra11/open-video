/**
 * OpenVideo MCP server (CLAUDE.md invariant 5: typed, gated MCP tools — not a raw shell). Exposes the
 * existing engine (edd/compiler/render/project/library/integrations) as tools the Claude CLI can call
 * during a headless session, closing the intent -> EDD -> render loop (roadmap Phase 1/2).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "./context.ts";
import { registerEddTools } from "./tools/edd.ts";
import { registerRenderTools } from "./tools/render.ts";
import { registerLibraryTools } from "./tools/library.ts";
import { registerAnalyzeTools } from "./tools/analyze.ts";
import { registerProjectTools } from "./tools/project.ts";
import { registerTranscribeTools } from "./tools/transcribe.ts";

export { createContext } from "./context.ts";
export type { McpContext } from "./context.ts";

export function createOpenVideoMcpServer(): McpServer {
  const ctx = createContext();
  const server = new McpServer({ name: "openvideo", version: "0.0.0" });
  registerProjectTools(server, ctx);
  registerEddTools(server, ctx);
  registerRenderTools(server, ctx);
  registerLibraryTools(server, ctx);
  registerAnalyzeTools(server, ctx);
  registerTranscribeTools(server, ctx);
  return server;
}
