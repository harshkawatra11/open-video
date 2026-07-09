// Word-level captions, reading from ../captions.json (built by work/gen_captions.cjs).
// KNOWN BUG (see CLAUDE.md "Captions"): any word that scales while active — emphasized OR
// karaoke-active — must get compensating margin or it collides with its neighbor. The margin
// rule below already covers both cases; if you add a new active/scale state, extend it the same way.
import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../theme";
import captionsData from "../captions.json";

type Word = { text: string; start: number; end: number; emph: boolean };
type Group = { start: number; end: number; words: Word[] };

const DATA = captionsData as { groups: Group[] };

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const group = DATA.groups.find((g) => t >= g.start && t <= g.end);
  if (!group) return null;

  const groupProgress = interpolate(t, [group.start, group.start + 0.15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 220,
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        padding: "0 60px",
        opacity: groupProgress,
        transform: `translateY(${interpolate(groupProgress, [0, 1], [16, 0])}px)`,
      }}
    >
      {group.words.map((w, i) => {
        const active = t >= w.start && t <= w.end;
        const scale = w.emph ? 1.15 : active ? 1.1 : 1;
        return (
          <span
            key={i}
            style={{
              fontFamily: FONTS.display,
              fontSize: 64,
              color: w.emph ? COLORS.accent : COLORS.white,
              textShadow: "0 4px 18px rgba(0,0,0,0.6)",
              transform: `scale(${scale})`,
              // Compensates the visual-only scale transform above — a scaled word does NOT
              // reserve extra flex layout space on its own. Cover every state that scales.
              margin: w.emph ? "0 14px" : active ? "0 10px" : "0 4px",
              whiteSpace: "nowrap",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
