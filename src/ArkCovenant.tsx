/**
 * ArkCovenant — Main Remotion composition.
 *
 * Each scene is rendered as a child <Sequence> at the correct frame offset.
 * To swap in real AI-generated images, pass an `imageUrl` prop to
 * CinematicScene for the relevant scene id.
 *
 * Total runtime: ~143 s at 30 fps (4 290 frames)
 */

import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { CinematicScene } from "./scenes/CinematicScene";
import { SCENES } from "./scenes/sceneData";

// Optional map of scene id → image URL.
// Populate once AI renders are ready, e.g.:
//   const IMAGE_MAP: Record<number, string> = {
//     1: "https://cdn.example.com/scene01.jpg",
//     ...
//   };
const IMAGE_MAP: Record<number, string> = {};

// ─── Title card ──────────────────────────────────────────────────────────────

const TitleCard: React.FC<{ progress: number }> = ({ progress }) => {
  const opacity = progress < 0.5
    ? progress * 2
    : (1 - progress) * 2;

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          color: "#ffd700",
          fontSize: 14,
          letterSpacing: "0.4em",
          textTransform: "uppercase",
          marginBottom: 24,
          opacity: 0.85,
        }}
      >
        A Biblical Documentary Cinematic Sequence
      </div>
      <div
        style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          color: "#ffffff",
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textAlign: "center",
          textShadow: "0 0 80px #ffd70088",
          lineHeight: 1.1,
        }}
      >
        THE ARK OF THE
        <br />
        COVENANT
      </div>
      <div
        style={{
          marginTop: 20,
          width: 120,
          height: 1,
          background: "linear-gradient(90deg, transparent, #ffd700, transparent)",
        }}
      />
      <div
        style={{
          fontFamily: "'Georgia', serif",
          color: "#ffd700",
          fontSize: 15,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          marginTop: 18,
          opacity: 0.7,
        }}
      >
        20 Scene Cinematic Sequence
      </div>
    </AbsoluteFill>
  );
};

// ─── Composition ─────────────────────────────────────────────────────────────

const TITLE_DURATION = 60; // 2 s

export const ArkCovenantComposition: React.FC = () => {
  const frame = useCurrentFrame();

  // Build frame-offset table
  const offsets: number[] = [];
  let cursor = TITLE_DURATION;
  for (const scene of SCENES) {
    offsets.push(cursor);
    cursor += scene.durationFrames;
  }

  const titleProgress = frame / (TITLE_DURATION - 1);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Title card */}
      <Sequence from={0} durationInFrames={TITLE_DURATION}>
        <TitleCard progress={titleProgress} />
      </Sequence>

      {/* Scene sequences */}
      {SCENES.map((scene, i) => (
        <Sequence
          key={scene.id}
          from={offsets[i]}
          durationInFrames={scene.durationFrames}
          name={`Scene ${String(scene.id).padStart(2, "0")} — ${scene.title}`}
        >
          <CinematicScene scene={scene} imageUrl={IMAGE_MAP[scene.id]} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
