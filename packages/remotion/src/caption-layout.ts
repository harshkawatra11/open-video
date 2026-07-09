/**
 * OpenVideo — pure caption-layout logic for the Overlay composition (doc 22/23 caption spec, PRD
 * §15.4). Kept free of React/Remotion imports so it can run under plain `node --test` like every
 * other package here, instead of only being exercised through an actual Remotion render.
 */

export interface CaptionWord {
  op: "caption";
  text: string;
  startFrame: number;
  endFrame: number;
  emph: boolean;
}

/** The words visible at `frame` (a short caption "window", not just a single word — karaoke-style
 *  captions typically show a small cluster around the current word). Returns them in order with an
 *  `active` flag for the one actually being spoken right now. */
export interface VisibleWord extends CaptionWord {
  active: boolean;
}

/** Groups caption words into "cards": consecutive runs where the gap between one word's end and the
 *  next word's start is below `gapFrames` (default: half a second at a nominal 30fps -> 15 frames,
 *  but callers pass the real fps-scaled gap). A card is what's shown on screen together. */
export function groupIntoCards(words: CaptionWord[], gapFrames: number): CaptionWord[][] {
  const sorted = [...words].sort((a, b) => a.startFrame - b.startFrame);
  const cards: CaptionWord[][] = [];
  let current: CaptionWord[] = [];
  for (const w of sorted) {
    const prev = current.at(-1);
    if (prev && w.startFrame - prev.endFrame > gapFrames) {
      cards.push(current);
      current = [];
    }
    current.push(w);
  }
  if (current.length > 0) cards.push(current);
  return cards;
}

/** The card (word cluster) visible at `frame`, or undefined if no caption is active. Each word in the
 *  card is annotated with whether it's the one currently being spoken. */
export function visibleCardAt(cards: CaptionWord[][], frame: number): VisibleWord[] | undefined {
  const card = cards.find((c) => frame >= c[0]!.startFrame && frame <= c.at(-1)!.endFrame);
  if (!card) return undefined;
  return card.map((w) => ({ ...w, active: frame >= w.startFrame && frame <= w.endFrame }));
}

/** Safe-margin lower-third vertical offset in px, given frame height and a configured margin — off-
 *  eyeline placement per STYLE.md's caption.position (doc 22 §A2, PRD anti-pattern: never over-eyeline). */
export function lowerThirdTopPx(heightPx: number, safeMarginPx: number, blockHeightPx: number): number {
  return Math.max(0, heightPx - safeMarginPx - blockHeightPx);
}
