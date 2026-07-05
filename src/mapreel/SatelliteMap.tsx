import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useVideoConfig } from "remotion";
import {
  Camera,
  layersForZoom,
  project,
  tileScreenRect,
  visibleTiles,
} from "./geo";
import type {
  LinkAnnotation,
  MapSegment,
  RulerAnnotation,
  Timeline,
} from "./types";

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

/**
 * GeoBites-style highlight: animated border draw-on, then a fill that is
 * either a diagonal hatch (default) or the country's flag painted inside
 * the border (when segment.flagSrc is set).
 */
const HighlightPolygon: React.FC<{
  cam: Camera;
  segment: MapSegment;
  tSec: number;
  patternId: string;
}> = ({ cam, segment, tSec, patternId }) => {
  const { width, height } = useVideoConfig();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const paths = segment.rings.map((ring) => {
    return (
      ring
        .map((pt, i) => {
          const p = project(cam, width, height, pt[0], pt[1]);
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
          return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join("") + "Z"
    );
  });
  const d = paths.join(" ");

  // Border draws on between 0.7s and 2.1s, fill paints in right behind it.
  const draw = interpolate(tSec, [0.7, 2.1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fillOpacity = interpolate(tSec, [1.2, 2.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const style = segment.highlightStyle ?? (segment.flagSrc ? "flag" : "hatch");

  if (style === "solid") {
    // GeoSolved's bright solid fill (their cyan Florida / Alaska look).
    return (
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute" }}>
          <path
            d={d}
            fill="rgba(45, 235, 255, 0.62)"
            opacity={fillOpacity}
            stroke="none"
          />
          <path
            d={d}
            fill="none"
            stroke="rgba(220, 252, 255, 0.98)"
            strokeWidth={5}
            strokeLinejoin="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - draw * 100}
            style={{ filter: "drop-shadow(0 0 14px rgba(45,235,255,0.9))" }}
          />
        </svg>
      </AbsoluteFill>
    );
  }

  if (style === "neon") {
    // GeoSolved look: glowing outline + everything outside the border dims.
    const dimPath = `M0,0H${width}V${height}H0Z ${d}`;
    return (
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute" }}>
          <path
            d={dimPath}
            fillRule="evenodd"
            fill="rgba(2, 12, 24, 0.42)"
            opacity={fillOpacity}
          />
          <path
            d={d}
            fill="none"
            stroke="rgba(0, 210, 255, 0.6)"
            strokeWidth={16}
            strokeLinejoin="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - draw * 100}
            style={{ filter: "blur(7px)" }}
          />
          <path
            d={d}
            fill="none"
            stroke="rgba(170, 245, 255, 1)"
            strokeWidth={4.5}
            strokeLinejoin="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - draw * 100}
            style={{ filter: "drop-shadow(0 0 12px rgba(0,220,255,1))" }}
          />
        </svg>
      </AbsoluteFill>
    );
  }

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
          <clipPath id={`clip-${patternId}`}>
            <path d={d} />
          </clipPath>
        </defs>
        {style === "flag" && segment.flagSrc ? (
          <g clipPath={`url(#clip-${patternId})`} opacity={fillOpacity * 0.88}>
            {(() => {
              // Cover the polygon bbox with a 4:3 flag, computed manually:
              // browsers render a referenced SVG with its own (letterbox)
              // aspect behavior, ignoring preserveAspectRatio="slice" here.
              const bw = Math.max(1, maxX - minX);
              const bh = Math.max(1, maxY - minY);
              const scale = Math.max(bw / 4, bh / 3);
              const fw = 4 * scale;
              const fh = 3 * scale;
              return (
                <image
                  href={staticFile(segment.flagSrc)}
                  x={minX + (bw - fw) / 2}
                  y={minY + (bh - fh) / 2}
                  width={fw}
                  height={fh}
                />
              );
            })()}
          </g>
        ) : (
          <path
            d={d}
            fill={`url(#${patternId})`}
            opacity={fillOpacity}
            stroke="none"
          />
        )}
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

/** GeoSolved-style animated distance ruler: line grows a→b, ticks + label. */
const Ruler: React.FC<{
  cam: Camera;
  ann: RulerAnnotation;
  tSec: number;
}> = ({ cam, ann, tSec }) => {
  const { width, height } = useVideoConfig();
  const t = tSec - ann.startOffsetSec;
  if (t < 0) return null;

  const grow = interpolate(t, [0, 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelIn = interpolate(t, [0.6, 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const p1 = project(cam, width, height, ann.a[0], ann.a[1]);
  const p2 = project(cam, width, height, ann.b[0], ann.b[1]);
  const ex = p1.x + (p2.x - p1.x) * grow;
  const ey = p1.y + (p2.y - p1.y) * grow;
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const tick = (x: number, y: number, show: boolean) =>
    show ? (
      <line
        x1={x}
        y1={y - 16}
        x2={x}
        y2={y + 16}
        stroke="white"
        strokeWidth={4}
      />
    ) : null;

  return (
    <AbsoluteFill>
      <svg
        width={width}
        height={height}
        style={{
          position: "absolute",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.9))",
        }}
      >
        <line x1={p1.x} y1={p1.y} x2={ex} y2={ey} stroke="white" strokeWidth={4} />
        {tick(p1.x, p1.y, true)}
        {tick(p2.x, p2.y, grow >= 1)}
      </svg>
      <div
        style={{
          position: "absolute",
          left: midX,
          // Below the line — the place label owns the space above it.
          top: midY + 26,
          transform: `translate(-50%, 0) scale(${0.8 + 0.2 * labelIn})`,
          opacity: labelIn,
          textAlign: "center",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: "white",
            backgroundColor: "rgba(200, 40, 40, 0.85)",
            padding: "4px 18px",
            borderRadius: 8,
            boxShadow: "0 4px 18px rgba(0,0,0,0.6)",
          }}
        >
          {ann.labelMi}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 34,
            fontWeight: 700,
            color: "white",
            textShadow: "0 2px 8px rgba(0,0,0,0.95)",
          }}
        >
          {ann.labelKm}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** GeoSolved-style connection line: grows a→b, pulsing ring at the target. */
const Link: React.FC<{
  cam: Camera;
  ann: LinkAnnotation;
  tSec: number;
}> = ({ cam, ann, tSec }) => {
  const { width, height } = useVideoConfig();
  const t = tSec - ann.startOffsetSec;
  if (t < 0 || t > ann.durationSec) return null;

  const grow = interpolate(t, [0, 0.9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = interpolate(t, [ann.durationSec - 0.4, ann.durationSec], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const p1 = project(cam, width, height, ann.a[0], ann.a[1]);
  const p2 = project(cam, width, height, ann.b[0], ann.b[1]);
  const ex = p1.x + (p2.x - p1.x) * grow;
  const ey = p1.y + (p2.y - p1.y) * grow;
  const pulse = 1 + 0.25 * Math.sin(t * 2 * Math.PI * 1.6);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <svg
        width={width}
        height={height}
        style={{
          position: "absolute",
          filter: "drop-shadow(0 0 8px rgba(255,220,60,0.8))",
        }}
      >
        <line
          x1={p1.x}
          y1={p1.y}
          x2={ex}
          y2={ey}
          stroke="rgba(255, 224, 70, 0.95)"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={p1.x} cy={p1.y} r={9} fill="rgba(255, 224, 70, 0.95)" />
        {grow >= 1 ? (
          <>
            <circle cx={p2.x} cy={p2.y} r={10} fill="rgba(255, 224, 70, 0.95)" />
            <circle
              cx={p2.x}
              cy={p2.y}
              r={26 * pulse}
              fill="none"
              stroke="rgba(255, 224, 70, 0.85)"
              strokeWidth={4}
            />
          </>
        ) : null}
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
      {/* Color grade: richer, punchier satellite look */}
      <AbsoluteFill
        style={{ filter: "saturate(1.25) contrast(1.08) brightness(0.94)" }}
      >
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
      </AbsoluteFill>
      {segment.rings.length > 0 ? (
        <HighlightPolygon
          cam={cam}
          segment={segment}
          tSec={tSec}
          patternId={`hatch-${segmentIndex}`}
        />
      ) : null}
      {(segment.annotations ?? []).map((ann, i) =>
        ann.type === "ruler" ? (
          <Ruler key={`ann-${i}`} cam={cam} ann={ann} tSec={tSec} />
        ) : (
          <Link key={`ann-${i}`} cam={cam} ann={ann} tSec={tSec} />
        )
      )}
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
