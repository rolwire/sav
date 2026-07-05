import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cameraAtTime } from "./geo";
import { Captions } from "./Captions";
import { PhotoPopup } from "./PhotoPopup";
import { SatelliteMap } from "./SatelliteMap";
import type { MapSegment, Timeline } from "./types";
import timelineJson from "./timeline.json";
import timelineWideJson from "./timeline-wide.json";

export const TIMELINE = timelineJson as unknown as Timeline;
export const TIMELINE_WIDE = timelineWideJson as unknown as Timeline;

/** Frames the incoming segment overlaps the previous one (crossfade). */
const FADE_FRAMES = 12;

const SegmentView: React.FC<{
  timeline: Timeline;
  segment: MapSegment;
  segmentIndex: number;
  fadeLead: number;
}> = ({ timeline, segment, segmentIndex, fadeLead }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const segDur = segment.endSec - segment.startSec;
  // During the crossfade lead-in, hold the camera at t = 0.
  const tSec = Math.max(0, Math.min(segDur, (frame - fadeLead) / fps));
  const cam = cameraAtTime(segment.camera, tSec, segDur);
  const opacity =
    fadeLead > 0
      ? interpolate(frame, [0, fadeLead], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <AbsoluteFill style={{ opacity }}>
      <SatelliteMap
        timeline={timeline}
        segment={segment}
        segmentIndex={segmentIndex}
        tSec={tSec}
        cam={cam}
      />
    </AbsoluteFill>
  );
};

const Credits: React.FC<{ lines: string[] }> = ({ lines }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 30,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity,
        fontFamily: "Helvetica, Arial, sans-serif",
        fontSize: 22,
        lineHeight: 1.5,
        color: "rgba(255,255,255,0.75)",
        textShadow: "0 1px 4px rgba(0,0,0,0.9)",
      }}
    >
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
};

const SetupScreen: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: "#06131d",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "Helvetica, Arial, sans-serif",
      color: "white",
      textAlign: "center",
      padding: 80,
    }}
  >
    <div style={{ fontSize: 90, fontWeight: 800, marginBottom: 40 }}>
      🌍 Map Reel
    </div>
    <div style={{ fontSize: 40, lineHeight: 1.6, color: "#9fd8e8" }}>
      No timeline yet. Generate one with:
      <br />
      <code style={{ color: "#40e0ff" }}>
        npm run reel -- --vo path/to/voiceover.mp3
      </code>
      <br />
      or preview the offline demo:
      <br />
      <code style={{ color: "#40e0ff" }}>npm run reel:demo</code>
    </div>
  </AbsoluteFill>
);

/** Music bed volume: quiet under speech, a bit louder in the gaps. */
const makeMusicVolume = (timeline: Timeline) => (frame: number): number => {
  const tSec = frame / timeline.fps;
  const speaking = timeline.captions.some(
    (g) => tSec >= g.startSec - 0.2 && tSec < g.endSec + 0.2
  );
  return speaking ? 0.09 : 0.22;
};

const MapReelBase: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const { fps } = useVideoConfig();

  if (timeline.segments.length === 0) {
    return <SetupScreen />;
  }

  const toF = (sec: number) => Math.round(sec * fps);
  const creditFrames = Math.min(75, timeline.durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: "#06131d" }}>
      {timeline.audioSrc ? <Audio src={staticFile(timeline.audioSrc)} /> : null}
      {timeline.musicSrc ? (
        <Audio
          src={staticFile(timeline.musicSrc)}
          volume={makeMusicVolume(timeline)}
        />
      ) : null}

      {timeline.segments.map((seg, i) => {
        const fadeLead = i > 0 ? FADE_FRAMES : 0;
        return (
          <Sequence
            key={i}
            from={toF(seg.startSec) - fadeLead}
            durationInFrames={toF(seg.endSec) - toF(seg.startSec) + fadeLead}
          >
            <SegmentView
              timeline={timeline}
              segment={seg}
              segmentIndex={i}
              fadeLead={fadeLead}
            />
          </Sequence>
        );
      })}

      {timeline.photos.map((cue, i) => (
        <Sequence
          key={`photo-${i}`}
          from={toF(cue.startSec)}
          durationInFrames={Math.round(cue.durationSec * fps)}
        >
          <PhotoPopup cue={cue} index={i} />
        </Sequence>
      ))}

      {(timeline.sfx ?? []).map((cue, i) => (
        <Sequence
          key={`sfx-${i}`}
          from={toF(cue.startSec)}
          durationInFrames={Math.round(2 * fps)}
        >
          <Audio src={staticFile(cue.src)} volume={cue.volume} />
        </Sequence>
      ))}

      <Captions captions={timeline.captions} />

      {timeline.credits.length > 0 ? (
        <Sequence
          from={timeline.durationInFrames - creditFrames}
          durationInFrames={creditFrames}
        >
          <Credits lines={timeline.credits} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

/** 9:16 vertical reel (timeline.json) */
export const MapReel: React.FC = () => <MapReelBase timeline={TIMELINE} />;

/** 16:9 landscape (timeline-wide.json) */
export const MapReelWide: React.FC = () => (
  <MapReelBase timeline={TIMELINE_WIDE} />
);
