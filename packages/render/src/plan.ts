/** OpenVideo — dispatch a DAG node to its execution plan (PRD §15). */

import { planCut, planGrade, planLevelAudio, planComposite, planEncode } from "./ffmpeg.ts";
import { planOverlay } from "./remotion.ts";
import { planVfx } from "./vfx.ts";
import type { ToolContext, ExecPlan } from "./context.ts";
import type { DAGNode } from "@openvideo/compiler";

export function planNode(node: DAGNode, ctx: ToolContext): ExecPlan {
  switch (node.op) {
    case "cut":
      return planCut(node, ctx);
    case "tonemap_grade":
      return planGrade(node, ctx);
    case "level_audio":
      return planLevelAudio(node, ctx);
    case "remotion_render":
      return planOverlay(node, ctx);
    case "ffmpeg_compose":
      return planComposite(node, ctx);
    case "encode":
      return planEncode(node, ctx);
    case "vfx_remove_object":
      return planVfx(node, ctx);
    default:
      throw new Error(`render: no plan builder for op "${node.op}" (node ${node.id})`);
  }
}

/** Plan an entire DAG, in its (already topological) node order. */
export function planDAG(nodes: DAGNode[], ctx: ToolContext): ExecPlan[] {
  return nodes.map((n) => planNode(n, ctx));
}
