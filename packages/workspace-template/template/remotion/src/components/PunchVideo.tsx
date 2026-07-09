// Alternating zoompan-style punch-ins on cut boundaries for the graded a-roll preview.
// Edit BOUNDS to the real cut timestamps (seconds) found for this source, or replace with
// a single flat <Video> if the edit needs no punch-ins at all.
import React from "react";
import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

const BOUNDS: number[] = [0]; // seconds — fill in with real cut points

export const PunchVideo: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  let idx = 0;
  for (let i = 0; i < BOUNDS.length; i++) {
    if (t >= BOUNDS[i]!) idx = i;
  }
  const segStart = BOUNDS[idx] ?? 0;
  const segEnd = BOUNDS[idx + 1] ?? segStart + 4;
  const zoomDirection = idx % 2 === 0 ? 1 : -1;
  const progress = interpolate(t, [segStart, segEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = 1 + zoomDirection * 0.03 * progress;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Video src={src} style={{ width: "100%", height: "100%", transform: `scale(${scale})` }} />
    </AbsoluteFill>
  );
};
