import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CameraMove, SceneData } from "./sceneData";

// ─── Camera transform helpers ────────────────────────────────────────────────

function getCameraTransform(
  move: CameraMove,
  progress: number,
  springVal: number
): string {
  switch (move) {
    case "descend":
      return `scale(${interpolate(progress, [0, 1], [1.18, 1.0])}) translateY(${interpolate(progress, [0, 1], [-4, 0])}%)`;
    case "forward":
      return `scale(${interpolate(progress, [0, 1], [1.0, 1.15])})`;
    case "dolly":
      return `scale(${interpolate(progress, [0, 1], [1.0, 1.12])}) translateY(${interpolate(progress, [0, 1], [0, -2])}%)`;
    case "glide":
      return `translateX(${interpolate(progress, [0, 1], [-2, 2])}%) scale(1.06)`;
    case "push-in":
      return `scale(${interpolate(progress, [0, 1], [1.0, 1.18])})`;
    case "orbit": {
      const angle = interpolate(progress, [0, 1], [-3, 3]);
      const sc = interpolate(progress, [0, 1], [1.0, 1.08]);
      return `rotate(${angle}deg) scale(${sc})`;
    }
    case "slide":
      return `translateX(${interpolate(progress, [0, 1], [2, -2])}%) scale(1.04)`;
    case "macro-rotate": {
      const angle = interpolate(progress, [0, 1], [-5, 5]);
      return `rotate(${angle}deg) scale(${interpolate(progress, [0, 1], [1.06, 1.12])})`;
    }
    case "top-down":
      return `scale(${interpolate(progress, [0, 1], [1.14, 1.0])}) translateY(${interpolate(progress, [0, 1], [-3, 0])}%)`;
    case "crane-down":
      return `scale(${interpolate(progress, [0, 1], [1.0, 1.1])}) translateY(${interpolate(progress, [0, 1], [-5, 0])}%)`;
    case "pull-back":
      return `scale(${interpolate(progress, [0, 1], [1.2, 0.95])})`;
    case "upward":
      return `scale(${interpolate(progress, [0, 1], [1.0, 1.1])}) translateY(${interpolate(progress, [0, 1], [3, -3])}%)`;
    default:
      return "scale(1)";
  }
}

// ─── Vignette overlay ────────────────────────────────────────────────────────

const Vignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.75) 100%)",
      pointerEvents: "none",
    }}
  />
);

// ─── Scene badge ─────────────────────────────────────────────────────────────

const SceneBadge: React.FC<{
  id: number;
  title: string;
  subtitle: string;
  accent: string;
  opacity: number;
}> = ({ id, title, subtitle, accent, opacity }) => (
  <div
    style={{
      position: "absolute",
      bottom: 72,
      left: 72,
      opacity,
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}
  >
    <div
      style={{
        fontSize: 13,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: accent,
        marginBottom: 6,
        opacity: 0.9,
      }}
    >
      Scene {String(id).padStart(2, "0")} — {subtitle}
    </div>
    <div
      style={{
        fontSize: 38,
        fontWeight: 700,
        color: "#ffffff",
        textShadow: `0 2px 24px ${accent}88, 0 0 60px ${accent}44`,
        lineHeight: 1.15,
        maxWidth: 700,
      }}
    >
      {title}
    </div>
    <div
      style={{
        marginTop: 10,
        width: 64,
        height: 2,
        background: accent,
        borderRadius: 1,
        opacity: 0.8,
      }}
    />
  </div>
);

// ─── Prompt overlay (bottom-right, for reference/export) ─────────────────────

const PromptOverlay: React.FC<{ prompt: string; accent: string; opacity: number }> = ({
  prompt,
  accent,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      bottom: 72,
      right: 72,
      maxWidth: 420,
      opacity: opacity * 0.65,
      fontFamily: "'Georgia', serif",
      textAlign: "right",
    }}
  >
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: accent,
        marginBottom: 5,
      }}
    >
      Generation Prompt
    </div>
    <div
      style={{
        fontSize: 12,
        color: "rgba(255,255,255,0.7)",
        lineHeight: 1.6,
      }}
    >
      {prompt}
    </div>
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  scene: SceneData;
  /** If an image URL is provided, it renders as the background; otherwise the CSS gradient is used */
  imageUrl?: string;
}

export const CinematicScene: React.FC<Props> = ({ scene, imageUrl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const progress = frame / (durationInFrames - 1);

  // Fade in / fade out
  const fadeIn = spring({ frame, fps, config: { damping: 30, stiffness: 80 } });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.6, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const masterOpacity = Math.min(fadeIn, fadeOut);

  // Badge fades in fast, then fades at 70% of scene
  const badgeOpacity =
    interpolate(frame, [0, fps * 0.5], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(
      frame,
      [durationInFrames * 0.7, durationInFrames * 0.88],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

  const promptOpacity =
    interpolate(frame, [fps * 0.5, fps * 1.2], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(
      frame,
      [durationInFrames * 0.75, durationInFrames * 0.9],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

  const transform = getCameraTransform(scene.cameraMove, progress, fadeIn);

  return (
    <AbsoluteFill style={{ background: "#000", opacity: masterOpacity }}>
      {/* Background layer with camera animation */}
      <div
        style={{
          position: "absolute",
          inset: "-10%",
          background: imageUrl ? undefined : scene.bg,
          backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform,
          willChange: "transform",
        }}
      />

      {/* Cinematic bars (2.39:1 letterbox) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "8%",
          background: "#000",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "8%",
          background: "#000",
        }}
      />

      {/* Vignette */}
      <Vignette />

      {/* Atmospheric colour grading overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${scene.accent}08 0%, transparent 70%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Scene badge */}
      <SceneBadge
        id={scene.id}
        title={scene.title}
        subtitle={scene.subtitle}
        accent={scene.accent}
        opacity={badgeOpacity}
      />

      {/* Prompt reference overlay */}
      <PromptOverlay
        prompt={scene.prompt}
        accent={scene.accent}
        opacity={promptOpacity}
      />

      {/* Scene counter top-right */}
      <div
        style={{
          position: "absolute",
          top: 56,
          right: 72,
          fontFamily: "'Georgia', serif",
          fontSize: 13,
          letterSpacing: "0.2em",
          color: scene.accent,
          opacity: badgeOpacity * 0.7,
          textTransform: "uppercase",
        }}
      >
        {String(scene.id).padStart(2, "0")} / 20
      </div>
    </AbsoluteFill>
  );
};
