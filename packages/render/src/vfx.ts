/**
 * OpenVideo — plan a `vfx_remove_object` DAG node (doc 25 §3, ADR-0011, VOID). Pure and testable like
 * every other planner here; the actual heavy inference call is injected at execution time (see
 * run-dag.ts's `voidExecutor`) so this package never depends on @openvideo/integrations directly.
 */

import { outPath } from "./context.ts";
import type { ToolContext, VfxPlan } from "./context.ts";
import type { DAGNode } from "@openvideo/compiler";

export function planVfx(node: DAGNode, ctx: ToolContext): VfxPlan {
  const inputPath = ctx.resolveInput(node.inputs[0] ?? "");
  const out = outPath(ctx, node);
  return {
    kind: "vfx",
    nodeId: node.id,
    inputPath,
    outPath: out,
    atS: node.params.atS as [number, number],
    region: node.params.region as VfxPlan["region"],
    maskRef: node.params.maskRef as string | undefined,
    prompt: node.params.prompt as string | undefined,
    provider: String(node.params.provider ?? "void"),
  };
}
