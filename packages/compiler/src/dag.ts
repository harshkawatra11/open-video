/**
 * OpenVideo — Execution DAG types (PRD §12.6, §14.1).
 *
 * Codegen lowers the IR into a directed acyclic graph of content-addressed tool invocations.
 * Each node is a typed tool call with fully-resolved inputs and a deterministic cache key
 * (hash of op + params + input keys + tool versions); edges are data dependencies. Unchanged
 * nodes are served from cache, which is what makes re-rendering incremental.
 *
 * Erasable TypeScript (types only).
 */

export type Resource = "gpu" | "cpu" | "chrome";

export interface DAGNode {
  /** Stable logical id (e.g. "grade:aroll", "overlay", "export"). */
  id: string;
  /** Tool operation, e.g. "cut" | "tonemap_grade" | "remotion_render" | "level_audio" | "ffmpeg_compose" | "encode". */
  op: string;
  /** ids this node consumes: either other node ids or EDD source ids. */
  inputs: string[];
  params: Record<string, unknown>;
  resource: Resource;
  /** content-addressed cache key: sha256(op + params + resolved input keys + tool versions). */
  key: string;
  /** expected cache-relative output path, derived from the key. */
  output: string;
}

export interface ExecutionDAG {
  /** topologically ordered: every node appears after all of its input nodes. */
  nodes: DAGNode[];
  /** the terminal node (the final export). */
  rootId: string;
}
