import { AbsoluteFill, Audio, staticFile } from "remotion";
import { PunchVideo } from "./components/PunchVideo";
import { OverlayContent } from "./Overlay";

// Full preview composition (a-roll + audio + overlay) — for Remotion Studio only.
// Final delivery is composited in ffmpeg from the Overlay PNG sequence, not rendered natively.
export const FinalEdit: React.FC<{ aroll: string; audio: string }> = ({ aroll, audio }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <PunchVideo src={staticFile(aroll)} />
      <Audio src={staticFile(audio)} />
      <OverlayContent />
    </AbsoluteFill>
  );
};
