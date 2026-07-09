/**
 * OpenVideo — the "Overlay" composition (ADR-0006, PRD §15.4): word-level captions + graphics as a
 * transparent layer, composited over the graded a-roll by ffmpeg. Props come straight from the
 * compiler's `remotion_render` node params (packages/compiler/src/compile.ts).
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { groupIntoCards, visibleCardAt } from "./caption-layout.ts";
import type { CaptionWord } from "./caption-layout.ts";

export interface GraphicProp {
  op: "graphic";
  id: string;
  component: string;
  props: Record<string, unknown>;
  startFrame: number;
  endFrame: number;
}

export interface OverlayProps {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  captions: CaptionWord[];
  graphics: GraphicProp[];
  /** STYLE.md-derived caption tokens (doc 22/23); sane editorial defaults if omitted. */
  caption?: {
    size?: number;
    weight?: number;
    safeMarginPx?: number;
    accent?: string;
  };
}

const DEFAULTS = { size: 64, weight: 800, safeMarginPx: 120, accent: "#C9A227" };

export function calculateOverlayMetadata(props: OverlayProps) {
  return {
    durationInFrames: Math.max(1, props.durationFrames),
    fps: props.fps,
    width: props.width,
    height: props.height,
  };
}

export function Overlay(props: OverlayProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const style = { ...DEFAULTS, ...props.caption };

  const gapFrames = Math.round(props.fps * 0.5);
  const cards = groupIntoCards(props.captions, gapFrames);
  const visible = visibleCardAt(cards, frame);

  const activeGraphics = props.graphics.filter((g) => frame >= g.startFrame && frame <= g.endFrame);

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {activeGraphics.map((g) => (
        <GraphicLayer key={g.id} graphic={g} />
      ))}
      {visible && visible.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: style.safeMarginPx,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "0.35em",
            padding: `0 ${Math.round(width * 0.06)}px`,
          }}
        >
          {visible.map((w, i) => (
            <span
              key={i}
              style={{
                fontFamily: '"Anton", "Inter", sans-serif',
                fontSize: style.size,
                fontWeight: style.weight,
                textTransform: w.emph ? "uppercase" : "none",
                color: w.emph || w.active ? style.accent : "#FFFFFF",
                textShadow: w.emph
                  ? `0 0 18px ${style.accent}, 0 2px 6px rgba(0,0,0,0.8)`
                  : "0 2px 6px rgba(0,0,0,0.8)",
                lineHeight: 1.1,
              }}
            >
              {w.text}
            </span>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
}

/** Renders a named graphic component. Unknown component names fall back to a labeled placeholder box
 *  (real graphic components are added here as the Motion agent/library grows — never silently drops
 *  a graphic the EDD asked for). */
function GraphicLayer({ graphic }: { graphic: GraphicProp }) {
  const known = GRAPHIC_COMPONENTS[graphic.component];
  if (known) return known(graphic.props);
  return (
    <div
      style={{
        position: "absolute",
        top: "10%",
        left: "10%",
        right: "10%",
        padding: 16,
        borderRadius: 10,
        background: "rgba(10,10,12,0.55)",
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 20,
      }}
    >
      [{graphic.component}] {JSON.stringify(graphic.props)}
    </div>
  );
}

const GRAPHIC_COMPONENTS: Record<string, (props: Record<string, unknown>) => React.JSX.Element> = {
  TitleCard: (p) => (
    <div
      style={{
        position: "absolute",
        top: "38%",
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: '"Anton", sans-serif',
        fontSize: 72,
        color: "#fff",
        textShadow: "0 4px 16px rgba(0,0,0,0.6)",
      }}
    >
      {String(p.text ?? "")}
    </div>
  ),
};
