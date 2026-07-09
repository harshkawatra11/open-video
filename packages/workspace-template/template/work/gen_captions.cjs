// Build word-level captions.json for Remotion from segment-level (transcript or Whisper) timings.
// Anchored to segment timings; words distributed within each segment by character length.
// Emphasis = any ALL-CAPS token (length>1) — extend isEmph() with topic-specific terms if needed.
//
// This is a starting pattern, not a fixed script — replace SEGMENTS with the real transcript for
// this edit (see ../transcript.txt or the Whisper output), and adjust HEAD_TRIM to whatever offset
// the graded a-roll actually has (0 if a-roll starts at the same point as the transcript).
const fs = require("fs");
const path = require("path");

const HEAD_TRIM = 0;

// [start, end, phrase] — fill in from the real transcript for this project.
const SEGMENTS = [
  // [0.0, 5.0, "Replace this with the real transcript segments for this edit."],
];

const isEmph = (tok) => {
  const t = tok.replace(/[^A-Za-z0-9]/g, "");
  return t.length > 1 && t === t.toUpperCase() && /[A-Z]/.test(t);
};

const words = [];
for (const [s, e, phrase] of SEGMENTS) {
  const toks = phrase.trim().split(/\s+/);
  const weights = toks.map((w) => w.replace(/[^A-Za-z0-9]/g, "").length + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < toks.length; i++) {
    const ws = s + ((e - s) * acc) / total;
    acc += weights[i];
    const we = s + ((e - s) * acc) / total;
    words.push({
      text: toks[i],
      start: Math.max(0, ws - HEAD_TRIM),
      end: Math.max(0, we - HEAD_TRIM),
      emph: isEmph(toks[i]),
    });
  }
}

// Chunk into caption groups of <=3 words; force a break after sentence-ending punctuation.
const groups = [];
let cur = [];
const flush = () => {
  if (!cur.length) return;
  groups.push({
    start: cur[0].start,
    end: cur[cur.length - 1].end,
    words: cur.map((w) => ({ text: w.text, start: w.start, end: w.end, emph: w.emph })),
  });
  cur = [];
};
for (const w of words) {
  cur.push(w);
  const endsSentence = /[.!?]$/.test(w.text);
  if (cur.length >= 3 || endsSentence) flush();
}
flush();

const out = { groups };
const dest = path.join(__dirname, "..", "remotion", "src", "captions.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log("words:", words.length, "groups:", groups.length, "->", dest);
