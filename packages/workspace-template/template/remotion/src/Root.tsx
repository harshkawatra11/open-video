import { Composition } from "remotion";
import { FinalEdit } from "./FinalEdit";
import { Overlay } from "./Overlay";
import { FPS, WIDTH, HEIGHT } from "./theme";

// Update DURATION to the graded a-roll's real duration once you have it (seconds * FPS).
const DURATION_SECONDS = 10;
const DURATION = Math.round(DURATION_SECONDS * FPS);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FinalEdit"
        component={FinalEdit}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ aroll: "aroll_graded.mp4", audio: "mix.wav" }}
      />
      <Composition
        id="Overlay"
        component={Overlay}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
