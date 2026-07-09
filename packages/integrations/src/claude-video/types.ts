/**
 * OpenVideo — claude-video: structured output of a footage vision-analysis pass (doc 25 §2). Feeds
 * the Planner/Story/Hook/B-roll agents something richer than transcript + probe metadata.
 */

export type ShotType = "wide" | "medium" | "close-up" | "extreme-close-up" | "unknown";

export interface ShotSegment {
  startS: number;
  endS: number;
  shotType: ShotType;
  /** 0 (static/dead) .. 1 (high motion/energy). */
  energy: number;
  subjects: string[];
  onScreenText?: string[];
  usable: boolean;
  note?: string;
}

export interface BrollOpportunity {
  atS: number;
  reason: string;
  suggestedTags: string[];
}

export interface FootageAnalysis {
  sourceId: string;
  frameCount: number;
  shots: ShotSegment[];
  brollOpportunities: BrollOpportunity[];
  suggestedHookInS: number[];
  deadRangesS: Array<[number, number]>;
}
