import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionGroup } from "./types";

/**
 * Word-level captions: shows the active caption group in the lower third,
 * highlighting the word currently being spoken.
 */
export const Captions: React.FC<{ captions: CaptionGroup[] }> = ({
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const tSec = frame / fps;

  const group = captions.find((g) => tSec >= g.startSec && tSec < g.endSec);
  if (!group) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: width * 0.06,
        right: width * 0.06,
        top: height * 0.72,
        textAlign: "center",
        fontFamily: "Helvetica, Arial, sans-serif",
        fontWeight: 800,
        fontSize: 62,
        lineHeight: 1.25,
        color: "white",
        textShadow:
          "0 3px 6px rgba(0,0,0,0.95), 0 0 24px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,1)",
      }}
    >
      {group.words.map((w, i) => {
        const active = tSec >= w.startSec && tSec < w.endSec;
        return (
          <span
            key={i}
            style={{
              color: active ? "#40e0ff" : "white",
              display: "inline-block",
              transform: active ? "scale(1.08)" : "scale(1)",
              margin: "0 0.18em",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
