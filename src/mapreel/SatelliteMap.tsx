import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useVideoConfig } from "remotion";
import {
  Camera,
  layersForZoom,
  project,
  tileScreenRect,
  visibleTiles,
} from "./geo";
import type { MapSegment, Timeline } from "./types";

const tileUrl = (template: string, z: number, x: number, y: number): string =>
  staticFile(
    template
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y))
  );

const TileLayer: React.FC<{
  cam: Camera;
  template: string;
  z: number;
  opacity: number;
}> = ({ cam, template, z, opacity }) => {
  const { width, height } = useVideoConfig();
  const range = visibleTiles(cam, width, height, z);
  const tiles: React.ReactNode[] = [];
  for (let x = range.minX; x <= range.maxX; x++) {
    for (let y = range.minY; y <= range.maxY; y++) {
      const rect = tileScreenRect(cam, width, height, z, x, y);
      tiles.push(
        <Img
          key={`${z}-${x}-${y}`}
          src={tileUrl(template, z, x, y)}
          style={{
            position: "absolute",
            left: rect.left,
            top: rect.top,
            // slight bleed hides sub-pixel seams between tiles
            width: rect.size + 0.7,
            height: rect.size + 0.7,
          }}
        />
      );
    }
  }
  return <AbsoluteFill style={{ opacity }}>{tiles}</AbsoluteFill>;
};

/** GeoBites-style highlight: animated border draw-on + diagonal hatch fill. */
const HighlightPolygon: React.FC<{
  cam: Camera;
  segment: MapSegment;
  tSec: number;
  patternId: string;
}> = ({ cam, segment, tSec, patternId }) => {
  const { width, height } = useVideoConfig();

  const paths = segment.rings.map((ring) => {
    return (
      ring
        .map((pt, i) => {
          const p = project(cam, width, height, pt[0], pt[1]);
          return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join("") + "Z"
    );
  });
  const d = paths.join(" ");

  // Border draws on between 0.7s and 2.1s, fill fades in right behind it.
  const draw = interpolate(tSec, [0.7, 2.1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fillOpacity = interpolate(tSec, [1.2, 2.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        <defs>
          <pattern
            id={patternId}
            width={26}
            height={26}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={26} height={26} fill="rgba(64, 224, 255, 0.18)" />
            <rect width={11} height={26} fill="rgba(64, 224, 255, 0.42)" />
          </pattern>
        </defs>
        <path
          d={d}
          fill={`url(#${patternId})`}
          opacity={fillOpacity}
          stroke="none"
        />
        <path
          d={d}
          fill="none"
          stroke="rgba(190, 245, 255, 0.95)"
          strokeWidth={5}
          strokeLinejoin="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - draw * 100}
          style={{ filter: "drop-shadow(0 0 10px rgba(64,224,255,0.9))" }}
        />
      </svg>
    </AbsoluteFill>
  );
};

const PlaceLabel: React.FC<{
  cam: Camera;
  segment: MapSegment;
  tSec: number;
}> = ({ cam, segment, tSec }) => {
  const { width, height } = useVideoConfig();
  const center = project(cam, width, height, segment.camera.lon, segment.camera.lat);
  const opacity = interpolate(tSec, [1.6, 2.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rise = interpolate(tSec, [1.6, 2.5], [26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = Math.max(width * 0.18, Math.min(width * 0.82, center.x));
  const y = Math.max(height * 0.2, Math.min(height * 0.62, center.y));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + rise,
        transform: "translate(-50%, -50%)",
        opacity,
        color: "white",
        fontFamily: "Helvetica, Arial, sans-serif",
        fontWeight: 800,
        fontSize: 72,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        textShadow: "0 2px 24px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)",
        whiteSpace: "nowrap",
      }}
    >
      {segment.name}
    </div>
  );
};

/** Full map view for one segment: tiles + highlight + label. */
export const SatelliteMap: React.FC<{
  timeline: Timeline;
  segment: MapSegment;
  segmentIndex: number;
  tSec: number;
  cam: Camera;
}> = ({ timeline, segment, segmentIndex, tSec, cam }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#06131d" }}>
      {timeline.tileTemplate
        ? layersForZoom(cam.zoom, timeline.tileMinZoom, timeline.tileMaxZoom).map(
            (layer) => (
              <TileLayer
                key={layer.z}
                cam={cam}
                template={timeline.tileTemplate as string}
                z={layer.z}
                opacity={layer.opacity}
              />
            )
          )
        : null}
      {segment.rings.length > 0 ? (
        <HighlightPolygon
          cam={cam}
          segment={segment}
          tSec={tSec}
          patternId={`hatch-${segmentIndex}`}
        />
      ) : null}
      <PlaceLabel cam={cam} segment={segment} tSec={tSec} />
      {/* subtle vignette for legibility */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
