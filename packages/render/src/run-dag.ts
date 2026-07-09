/**
 * OpenVideo — execute an execution DAG (PRD §14). Runs nodes in topological order, skips nodes
 * whose content-addressed output already exists (cache hit), and emits progress events. Returns the
 * absolute path of the terminal (export) node's output.
 */

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { ExecutionDAG } from "@openvideo/compiler";
import type { RenderCapabilities, ToolContext, VfxPlan } from "./context.ts";
import { planNode } from "./plan.ts";
import { runFfmpeg, runRemotion } from "./execute.ts";

export type RunEvent =
  | { type: "node-start"; id: string; op: string }
  | { type: "node-cached"; id: string; output: string }
  | { type: "node-done"; id: string; output: string }
  | { type: "node-error"; id: string; message: string };

export interface RunOptions {
  projectDir: string;
  width: number;
  height: number;
  fps: number;
  capabilities: RenderCapabilities;
  /** EDD source id -> absolute media path. */
  sources: Record<string, string>;
  onEvent?: (e: RunEvent) => void;
  /** Executes a `vfx_remove_object` node (VOID). Injected by the caller — this package never depends
   *  on @openvideo/integrations directly (circular: integrations depends on render). If a DAG has a
   *  vfx node and no executor is supplied, that node fails with a clear, honest error rather than
   *  silently skipping the effect the EDD asked for. */
  voidExecutor?: (plan: VfxPlan) => Promise<void>;
}

export async function runDAG(dag: ExecutionDAG, o: RunOptions): Promise<string> {
  const outAbs = new Map<string, string>();
  for (const n of dag.nodes) outAbs.set(n.id, path.join(o.projectDir, n.output));

  const resolveInput = (id: string): string => {
    const fromNode = outAbs.get(id);
    if (fromNode) return fromNode;
    const fromSource = o.sources[id];
    if (fromSource) return fromSource;
    throw new Error(`runDAG: cannot resolve input "${id}"`);
  };

  const ctx: ToolContext = {
    projectDir: o.projectDir,
    width: o.width,
    height: o.height,
    fps: o.fps,
    capabilities: o.capabilities,
    resolveInput,
  };

  for (const node of dag.nodes) {
    const dest = outAbs.get(node.id)!;
    if (existsSync(dest)) {
      o.onEvent?.({ type: "node-cached", id: node.id, output: dest });
      continue;
    }
    mkdirSync(path.dirname(dest), { recursive: true });
    o.onEvent?.({ type: "node-start", id: node.id, op: node.op });
    try {
      const plan = planNode(node, ctx);
      if (plan.kind === "ffmpeg") {
        await runFfmpeg(plan.args);
      } else if (plan.kind === "remotion") {
        if (plan.pngSeqDir) mkdirSync(plan.pngSeqDir, { recursive: true });
        await runRemotion(plan);
      } else {
        if (!o.voidExecutor) {
          throw new Error(
            `runDAG: node "${node.id}" needs a VOID vfx executor, but none was configured — pass { voidExecutor } to runDAG (see @openvideo/integrations' removeObject).`,
          );
        }
        await o.voidExecutor(plan);
      }
      o.onEvent?.({ type: "node-done", id: node.id, output: dest });
    } catch (e) {
      o.onEvent?.({ type: "node-error", id: node.id, message: (e as Error).message });
      throw e;
    }
  }

  const root = dag.nodes.find((n) => n.id === dag.rootId);
  if (!root) throw new Error("runDAG: DAG has no root node");
  return outAbs.get(root.id)!;
}
