/**
 * OpenVideo MCP tools — edd_get / edd_apply_patch (CLAUDE.md invariant 1: Claude authors/patches the
 * EDD; the contract is the validated EDD, never free-form shell output). The agent submits the whole
 * next EDD as a JSON string; we validate it with `@openvideo/edd`'s own validator before persisting —
 * an invalid patch is rejected with diagnostics, never silently applied.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { openProject, loadEdd, saveEdd } from "@openvideo/project";
import { validateEDD } from "@openvideo/edd";
import type { EDD } from "@openvideo/edd";
import type { McpContext } from "../context.ts";
import { jsonResult, errorResult } from "../result.ts";

export function registerEddTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "edd_get",
    {
      title: "Get the project's current Edit Decision Document",
      description:
        "Returns the current EDD (Video AST) for a project as JSON — sources, timeline tracks (video/captions/graphics/audio), and export spec. Read this before patching so edits are additive to what already exists.",
      inputSchema: { projectId: z.string().describe("The project id, e.g. prj_abc123") },
    },
    async ({ projectId }) => {
      const proj = openProject(ctx.projectsDir, projectId);
      const edd = loadEdd(proj);
      if (!edd) return errorResult(`project "${projectId}" has no EDD yet — ingest a clip first.`);
      return jsonResult(edd);
    },
  );

  server.registerTool(
    "edd_apply_patch",
    {
      title: "Replace the project's EDD with a validated next version",
      description:
        "Submits the COMPLETE next EDD (as a JSON string) for a project — not a diff. It is validated with the same validator the render pipeline trusts; invalid EDDs are rejected with diagnostics and NOT saved. Always call edd_get first, then submit the full document with your changes applied (e.g. new caption words, a grade effect, a music track).",
      inputSchema: {
        projectId: z.string(),
        edd: z.string().describe("The full next EDD as a JSON string (same shape as edd_get's output)."),
      },
    },
    async ({ projectId, edd: eddJson }) => {
      const proj = openProject(ctx.projectsDir, projectId);
      let next: EDD;
      try {
        next = JSON.parse(eddJson) as EDD;
      } catch (e) {
        return errorResult(`edd is not valid JSON: ${(e as Error).message}`);
      }
      const diagnostics = validateEDD(next);
      const errors = diagnostics.filter((d) => d.severity === "error");
      if (errors.length > 0) {
        return errorResult(`EDD rejected — ${errors.length} validation error(s):\n${JSON.stringify(errors, null, 2)}`);
      }
      saveEdd(proj, next);
      return jsonResult({ ok: true, diagnostics });
    },
  );
}
