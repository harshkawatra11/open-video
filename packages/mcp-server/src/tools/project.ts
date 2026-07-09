/** OpenVideo MCP tool — project_get: a compact project summary (manifest + EDD presence) for orienting
 *  the agent at the start of a session, without dumping the full EDD (use edd_get for that). */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs";
import path from "node:path";
import { openProject, readManifest, loadEdd } from "@openvideo/project";
import type { McpContext } from "../context.ts";
import { jsonResult, errorResult } from "../result.ts";

export function registerProjectTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "project_get",
    {
      title: "Get a project's summary (metadata, assets, whether an EDD exists)",
      description: "Orienting call for the start of a session: project name/platform, ingested assets with their provenance, and whether an EDD exists yet (call edd_get for the full document).",
      inputSchema: { projectId: z.string() },
    },
    async ({ projectId }) => {
      const proj = openProject(ctx.projectsDir, projectId);
      const metaPath = path.join(proj.dir, "project.json");
      if (!fs.existsSync(metaPath)) return errorResult(`project "${projectId}" not found.`);
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const manifest = readManifest(proj.dir);
      const edd = loadEdd(proj);
      return jsonResult({ ...meta, assets: manifest, hasEdd: Boolean(edd) });
    },
  );
}
