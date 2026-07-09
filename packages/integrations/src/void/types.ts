/**
 * OpenVideo — VOID: interaction-aware object/person/logo removal (doc 25 §3, ADR-0011). Heavy tier,
 * GPU-bound (CogVideoX + SAM2/3 weights).
 */

export interface RemoveObjectRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RemoveObjectSpec {
  clipPath: string;
  /** [startS, endS] range within the clip to operate on. */
  atS: [number, number];
  region?: RemoveObjectRegion;
  maskPath?: string;
  /** Natural-language description of what to remove, e.g. "the person waving in the background". */
  prompt?: string;
}

export interface RemoveObjectResult {
  outputPath: string;
}
