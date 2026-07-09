/**
 * OpenVideo MCP tool — edd_render (CLAUDE.md invariant 2: intent -> plan -> EDD -> IR -> DAG ->
 * render, never ad-hoc tool scripting). Compiles the project's current EDD to a content-addressed DAG
 * and really executes it via the same `runDAG` the daemon's HTTP render route uses — no separate code
 * path, no raw ffmpeg/shell access for the agent.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { openProject, loadEdd, sourcesMap } from "@openvideo/project";
import { compile } from "@openvideo/compiler";
import { runDAG, isAvailable } from "@openvideo/render";
import type { VfxPlan } from "@openvideo/render";
import { removeObject } from "@openvideo/integrations";
import type { McpContext } from "../context.ts";
import { jsonResult, errorResult } from "../result.ts";

/** Bridges a render-package VfxPlan (data-only, no integrations dependency — see
 *  packages/render/src/context.ts) to the real VOID adapter. Honest failures (no GPU / weights not
 *  installed) propagate as-is; never silently skips the effect. */
async function voidExecutor(plan: VfxPlan): Promise<void> {
  await removeObject(
    { clipPath: plan.inputPath, atS: plan.atS, region: plan.region, maskPath: plan.maskRef, prompt: plan.prompt },
    plan.outPath,
  );
}

export function registerRenderTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "edd_render",
    {
      title: "Compile and render the project's current EDD to a real video file",
      description:
        "Compiles the saved EDD into a content-addressed execution DAG and runs it for real (ffmpeg cut/grade/audio/composite/export; cached nodes are skipped). Call this after edd_apply_patch. Blocks until the render finishes or fails; returns the output file path.",
      inputSchema: { projectId: z.string() },
    },
    async ({ projectId }) => {
      const proj = openProject(ctx.projectsDir, projectId);
      const edd = loadEdd(proj);
      if (!edd) return errorResult(`project "${projectId}" has no EDD yet.`);
      try {
        const dag = compile(edd);
        const events: string[] = [];
        const out = await runDAG(dag, {
          projectDir: proj.dir,
          width: edd.project.width,
          height: edd.project.height,
          fps: edd.project.fps,
          capabilities: { gpu: { nvidia: isAvailable("nvidia-smi") }, remotionCompositor: "unhealthy" },
          sources: sourcesMap(proj),
          onEvent: (e) => events.push(e.type),
          voidExecutor,
        });
        return jsonResult({ ok: true, output: out, phases: events });
      } catch (e) {
        return errorResult(`render failed: ${(e as Error).message}`);
      }
    },
  );
}
