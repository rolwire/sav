import React from "react";
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { PhotoCue } from "./types";

/**
 * Polaroid-style photo that springs in when its keyword is spoken.
 * Rendered inside a Sequence that spans the cue, so frame 0 = cue start.
 */
export const PhotoPopup: React.FC<{ cue: PhotoCue; index: number }> = ({
  cue,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const durFrames = Math.round(cue.durationSec * fps);
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const exit = interpolate(frame, [durFrames - 10, durFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rot = (index % 2 === 0 ? -1 : 1) * (3 + (index % 3));
  const x = cue.side === "left" ? width * 0.28 : width * 0.72;
  const y = height * 0.26;
  const drift = interpolate(frame, [0, durFrames], [0, -18]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + drift,
        transform: `translate(-50%, -50%) scale(${enter}) rotate(${rot}deg)`,
        opacity: exit,
        backgroundColor: "#fff",
        padding: 14,
        paddingBottom: 44,
        borderRadius: 6,
        boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
      }}
    >
      <Img
        src={staticFile(cue.src)}
        style={{
          width: width * 0.42,
          height: width * 0.42 * 0.75,
          objectFit: "cover",
          borderRadius: 3,
          display: "block",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "Helvetica, Arial, sans-serif",
          fontWeight: 600,
          fontSize: 24,
          color: "#333",
          textTransform: "capitalize",
        }}
      >
        {cue.keyword}
      </div>
    </div>
  );
};
