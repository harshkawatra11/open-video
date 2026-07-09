/**
 * OpenVideo — render context + execution-plan types (PRD §15).
 *
 * An ExecPlan is the concrete, runnable form of a DAG node: an FFmpeg argv, or a Remotion render
 * invocation (native alpha .mov, or the PNG-sequence fallback + an ffmpeg assemble step — ADR-0006).
 * The daemon's executor consumes ExecPlans; this package only *builds* them (pure, testable). Pixel
 * correctness is validated later with media + golden frames (docs/18-testing-and-qa.md).
 */

import path from "node:path";
import type { DAGNode } from "@openvideo/compiler";

export interface RenderCapabilities {
  gpu: { nvidia: boolean };
  /** Health of the Remotion native compositor binary (ADR-0006). */
  remotionCompositor: "healthy" | "unhealthy" | "unknown";
}

export interface ToolContext {
  projectDir: string;
  width: number;
  height: number;
  fps: number;
  capabilities: RenderCapabilities;
  /** Resolve a node id or EDD source id to an absolute input file path. */
  resolveInput: (id: string) => string;
}

export function outPath(ctx: ToolContext, node: DAGNode): string {
  return path.join(ctx.projectDir, node.output);
}

export type ExecPlan = FfmpegPlan | RemotionPlan | VfxPlan;

export interface FfmpegPlan {
  kind: "ffmpeg";
  nodeId: string;
  args: string[];
  output: string;
}

export interface RemotionPlan {
  kind: "remotion";
  nodeId: string;
  mode: "native" | "pngseq";
  composition: string;
  props: Record<string, unknown>;
  outPath: string;
  cliArgs: string[];
  /** pngseq mode only: assemble the PNG sequence into the alpha .mov. */
  assembleArgs?: string[];
  pngSeqDir?: string;
}

/** A `vfx_remove_object` node (doc 25 §3, ADR-0011, VOID). Deliberately data-only — this package
 *  does NOT depend on @openvideo/integrations (which itself depends on @openvideo/render, e.g. for
 *  isAvailable/resolveBin), so a real VOID dependency here would be circular. The actual removeObject
 *  call is injected by the caller (see RunOptions.voidExecutor in run-dag.ts), which does have both
 *  packages available (the daemon, packages/mcp-server). */
export interface VfxPlan {
  kind: "vfx";
  nodeId: string;
  inputPath: string;
  outPath: string;
  atS: [number, number];
  region?: { x: number; y: number; w: number; h: number };
  maskRef?: string;
  prompt?: string;
  provider: string;
}
