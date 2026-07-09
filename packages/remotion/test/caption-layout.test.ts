import { test } from "node:test";
import assert from "node:assert/strict";
import { groupIntoCards, visibleCardAt, lowerThirdTopPx } from "../src/caption-layout.ts";
import type { CaptionWord } from "../src/caption-layout.ts";

function word(text: string, startFrame: number, endFrame: number, emph = false): CaptionWord {
  return { op: "caption", text, startFrame, endFrame, emph };
}

test("groupIntoCards clusters words with small gaps, splits on large gaps", () => {
  const words = [word("hello", 0, 10), word("world", 11, 20), word("later", 60, 70)];
  const cards = groupIntoCards(words, 15);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0]!.map((w) => w.text), ["hello", "world"]);
  assert.deepEqual(cards[1]!.map((w) => w.text), ["later"]);
});

test("groupIntoCards sorts out-of-order input by startFrame", () => {
  const words = [word("b", 20, 30), word("a", 0, 10)];
  const cards = groupIntoCards(words, 5);
  assert.deepEqual(cards.flat().map((w) => w.text), ["a", "b"]);
});

test("visibleCardAt returns the card containing the frame, with the active word flagged", () => {
  const words = [word("hello", 0, 10), word("world", 11, 20)];
  const cards = groupIntoCards(words, 15);
  const visible = visibleCardAt(cards, 12);
  assert.ok(visible);
  assert.equal(visible!.length, 2);
  assert.equal(visible!.find((w) => w.text === "world")!.active, true);
  assert.equal(visible!.find((w) => w.text === "hello")!.active, false);
});

test("visibleCardAt returns undefined outside any card's range", () => {
  const words = [word("hello", 0, 10)];
  const cards = groupIntoCards(words, 5);
  assert.equal(visibleCardAt(cards, 100), undefined);
});

test("lowerThirdTopPx places the caption block off-eyeline near the bottom, never negative", () => {
  assert.equal(lowerThirdTopPx(1920, 120, 100), 1700);
  assert.equal(lowerThirdTopPx(100, 120, 100), 0); // clamps instead of going negative
});
