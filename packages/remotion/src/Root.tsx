import React from "react";
import { Composition } from "remotion";
import { Overlay, calculateOverlayMetadata } from "./Overlay.tsx";
import type { OverlayProps } from "./Overlay.tsx";

const DEFAULT_PROPS: OverlayProps = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 90,
  captions: [],
  graphics: [],
};

export function RemotionRoot() {
  return (
    <Composition
      id="Overlay"
      component={Overlay}
      durationInFrames={DEFAULT_PROPS.durationFrames}
      fps={DEFAULT_PROPS.fps}
      width={DEFAULT_PROPS.width}
      height={DEFAULT_PROPS.height}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={async ({ props }) => calculateOverlayMetadata(props as OverlayProps)}
    />
  );
}
