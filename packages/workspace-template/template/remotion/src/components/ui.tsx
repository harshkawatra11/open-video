// Small shared helpers reused across hand-authored graphic components.
// Add to this file as you build new beats — don't duplicate the spring/pop-in boilerplate per component.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../theme";

// Spring that enters from 0->1 starting at `delay` frames
export const useEnter = (delay = 0, config?: object) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, mass: 0.8, ...(config ?? {}) },
  });
};

// Pop-in scale + fade helper
export const popStyle = (p: number): React.CSSProperties => ({
  opacity: interpolate(p, [0, 1], [0, 1]),
  transform: `scale(${interpolate(p, [0, 1], [0.8, 1])})`,
});

export const Bottom: React.FC<{ children: React.ReactNode; pad?: number }> = ({
  children,
  pad = 150,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: pad,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "0 70px",
    }}
  >
    {children}
  </div>
);

// Frosted brand card
export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: `linear-gradient(160deg, ${COLORS.primary}F2, ${COLORS.primary2}F2)`,
      border: `2px solid ${COLORS.accent}66`,
      borderRadius: 28,
      boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
      backdropFilter: "blur(8px)",
      fontFamily: FONTS.body,
      color: COLORS.white,
      ...style,
    }}
  >
    {children}
  </div>
);

export const AccentBar: React.FC<{ w?: number }> = ({ w = 90 }) => (
  <div
    style={{
      width: w,
      height: 7,
      borderRadius: 4,
      background: COLORS.accent,
      margin: "0 auto",
    }}
  />
);
