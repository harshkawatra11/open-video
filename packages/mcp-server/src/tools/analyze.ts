/**
 * OpenVideo MCP tool — analyze_footage (doc 25 §2, claude-video). Lets the Director actually *watch*
 * the footage (scene-aware keyframes + transcript) before planning, instead of only seeing probe
 * metadata.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs";
import path from "node:path";
import { openProject, loadEdd } from "@openvideo/project";
import { analyzeFootage } from "@openvideo/integrations";
import type { McpContext } from "../context.ts";
import { jsonResult, errorResult } from "../result.ts";

export function registerAnalyzeTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "analyze_footage",
    {
      title: "Run vision-analysis on a project's footage",
      description:
        "Extracts scene-aware keyframes via ffmpeg and asks Claude to identify shot types/energy, subjects, on-screen text, usable vs. dead ranges, b-roll opportunities, and good hook in-points. Cached per source — cheap to call again. Use this before drafting a cut so decisions are footage-aware, not just transcript-aware.",
      inputSchema: { projectId: z.string(), sourceId: z.string().optional() },
    },
    async ({ projectId, sourceId }) => {
      const proj = openProject(ctx.projectsDir, projectId);
      const edd = loadEdd(proj);
      if (!edd) return errorResult(`project "${projectId}" has no EDD yet.`);
      const id = sourceId ?? edd.sources[0]?.id;
      const source = edd.sources.find((s) => s.id === id);
      if (!source) return errorResult(`no source "${id}" on this project.`);
      const videoPath = path.join(proj.dir, source.path);
      const transcriptPath = path.join(proj.dir, "transcripts", `${id}.txt`);
      const transcript = fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, "utf8") : undefined;
      try {
        const analysis = await analyzeFootage(videoPath, {
          sourceId: id!,
          transcript,
          cacheDir: path.join(proj.dir, "cache", "footage-analysis"),
        });
        return jsonResult(analysis);
      } catch (e) {
        return errorResult(`analyze_footage failed: ${(e as Error).message}`);
      }
    },
  );
}
