import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { loadFonts } from "./fonts";
import { Captions } from "./components/Captions";

loadFonts();

// All graphics + captions on a TRANSPARENT background (no a-roll, no audio).
// Rendered to a PNG sequence and composited over the a-roll in ffmpeg (see CLAUDE.md).
//
// This is a skeleton — author project-specific graphic-beat components under ./components/
// (hook, lower-third, stat callouts, comparison cards, etc. per PRD.md) and add a <Sequence>
// entry for each below. Keep Captions last so it renders on top.
export const OverlayContent: React.FC = () => {
  const { fps } = useVideoConfig();
  const S = (s: number) => Math.round(s * fps);

  return (
    <>
      {/* Example:
      <Sequence from={S(0)} durationInFrames={S(3)}>
        <Hook />
      </Sequence>
      */}

      <Captions />
    </>
  );
};

export const Overlay: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <OverlayContent />
    </AbsoluteFill>
  );
};
