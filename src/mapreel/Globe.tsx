import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { geoOrthographic, geoPath, geoGraticule10, GeoProjection } from "d3-geo";
import { mesh } from "topojson-client";
import type { Feature, Geometry, MultiPolygon } from "geojson";
import type { Topology } from "topojson-specification";
import countries50m from "world-atlas/countries-50m.json";
import { flyDurationFor, globeCameraAtGlobalTime } from "./geo";
import type {
  Annotation,
  LinkAnnotation,
  MapSegment,
  RulerAnnotation,
  Timeline,
} from "./types";
import { COUNTRIES, LAND } from "./worldData";

// Interior country borders as one mesh path (computed once).
const BORDER_MESH = mesh(
  countries50m as unknown as Topology,
  (countries50m as unknown as Topology).objects.countries as never,
  (a: unknown, b: unknown) => a !== b
);

type ProjPath = ReturnType<typeof geoPath>;

const makeProjection = (
  lambda: number,
  phi: number,
  scale: number,
  width: number,
  height: number
): GeoProjection =>
  geoOrthographic()
    .rotate([lambda, phi])
    .scale(scale)
    .translate([width / 2, height / 2])
    .clipAngle(90);

/** Project a lon/lat point; null if it's on the far side of the globe. */
const projectPoint = (
  proj: GeoProjection,
  lon: number,
  lat: number
): { x: number; y: number } | null => {
  const p = proj([lon, lat]);
  if (!p) return null;
  // clipAngle hides far-side geometry in paths but proj() still returns coords;
  // test the angle to the rotation center ourselves.
  const c = proj.rotate();
  const toR = Math.PI / 180;
  const cosd =
    Math.sin(-c[1] * toR) * Math.sin(lat * toR) +
    Math.cos(-c[1] * toR) * Math.cos(lat * toR) * Math.cos((lon + c[0]) * toR);
  if (cosd < 0) return null;
  return { x: p[0], y: p[1] };
};

const segmentFeature = (seg: MapSegment): Feature<MultiPolygon> => ({
  type: "Feature",
  properties: {},
  geometry: {
    type: "MultiPolygon",
    coordinates: seg.rings.map((r) => [r as number[][]]),
  },
});

const HighlightOnGlobe: React.FC<{
  proj: GeoProjection;
  path: ProjPath;
  seg: MapSegment;
  tSec: number;
  idx: number;
}> = ({ proj, path, seg, tSec, idx }) => {
  const { width, height } = useVideoConfig();
  const feat = segmentFeature(seg);
  const d = path(feat);
  if (!d) return null;

  const style = seg.highlightStyle ?? (seg.flagSrc ? "flag" : "hatch");
  const draw = interpolate(tSec, [0.7, 2.1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fill = interpolate(tSec, [1.2, 2.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clipId = `globe-clip-${idx}`;
  const hatchId = `globe-hatch-${idx}`;
  const bounds = path.bounds(feat); // [[x0,y0],[x1,y1]]
  const bw = Math.max(1, bounds[1][0] - bounds[0][0]);
  const bh = Math.max(1, bounds[1][1] - bounds[0][1]);

  const fillEl = () => {
    if (style === "flag" && seg.flagSrc) {
      const scale = Math.max(bw / 4, bh / 3);
      const fw = 4 * scale;
      const fh = 3 * scale;
      return (
        <g clipPath={`url(#${clipId})`} opacity={fill * 0.9}>
          <image
            href={staticFile(seg.flagSrc)}
            x={bounds[0][0] + (bw - fw) / 2}
            y={bounds[0][1] + (bh - fh) / 2}
            width={fw}
            height={fh}
          />
        </g>
      );
    }
    if (style === "solid") {
      return <path d={d} fill="rgba(45,235,255,0.62)" opacity={fill} />;
    }
    if (style === "neon") return null;
    return <path d={d} fill={`url(#${hatchId})`} opacity={fill} />;
  };

  const strokeColor =
    style === "neon" ? "rgba(170,245,255,1)" : "rgba(220,252,255,0.98)";

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={d} />
        </clipPath>
        <pattern
          id={hatchId}
          width={26}
          height={26}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={26} height={26} fill="rgba(64,224,255,0.18)" />
          <rect width={11} height={26} fill="rgba(64,224,255,0.42)" />
        </pattern>
      </defs>
      {fillEl()}
      {style === "neon" ? (
        <path
          d={d}
          fill="none"
          stroke="rgba(0,210,255,0.55)"
          strokeWidth={15}
          strokeLinejoin="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - draw * 100}
          style={{ filter: "blur(6px)" }}
        />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={style === "neon" ? 4.5 : 5}
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={100 - draw * 100}
        style={{ filter: "drop-shadow(0 0 11px rgba(0,220,255,0.9))" }}
      />
    </svg>
  );
};

const GlobeLabel: React.FC<{
  proj: GeoProjection;
  seg: MapSegment;
  tSec: number;
}> = ({ proj, seg, tSec }) => {
  const pt = projectPoint(proj, seg.camera.lon, seg.camera.lat);
  if (!pt) return null;
  const opacity = interpolate(tSec, [1.6, 2.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rise = interpolate(tSec, [1.6, 2.5], [26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: pt.x,
        top: pt.y + rise,
        transform: "translate(-50%, -50%)",
        opacity,
        color: "white",
        fontFamily: "Helvetica, Arial, sans-serif",
        fontWeight: 800,
        fontSize: 66,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        textShadow: "0 2px 24px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.85)",
        whiteSpace: "nowrap",
      }}
    >
      {seg.name}
    </div>
  );
};

const GlobeRuler: React.FC<{
  proj: GeoProjection;
  ann: RulerAnnotation;
  tSec: number;
}> = ({ proj, ann, tSec }) => {
  const { width, height } = useVideoConfig();
  const t = tSec - ann.startOffsetSec;
  if (t < 0) return null;
  const p1 = projectPoint(proj, ann.a[0], ann.a[1]);
  const p2 = projectPoint(proj, ann.b[0], ann.b[1]);
  if (!p1 || !p2) return null;
  const grow = interpolate(t, [0, 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelIn = interpolate(t, [0.6, 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ex = p1.x + (p2.x - p1.x) * grow;
  const ey = p1.y + (p2.y - p1.y) * grow;
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  return (
    <>
      <svg
        width={width}
        height={height}
        style={{
          position: "absolute",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.9))",
        }}
      >
        <line x1={p1.x} y1={p1.y} x2={ex} y2={ey} stroke="white" strokeWidth={4} />
        <line x1={p1.x} y1={p1.y - 15} x2={p1.x} y2={p1.y + 15} stroke="white" strokeWidth={4} />
        {grow >= 1 ? (
          <line x1={p2.x} y1={p2.y - 15} x2={p2.x} y2={p2.y + 15} stroke="white" strokeWidth={4} />
        ) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: midX,
          top: midY + 22,
          transform: `translate(-50%,0) scale(${0.8 + 0.2 * labelIn})`,
          opacity: labelIn,
          textAlign: "center",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: "white",
            backgroundColor: "rgba(200,40,40,0.85)",
            padding: "3px 16px",
            borderRadius: 8,
          }}
        >
          {ann.labelMi}
        </div>
        <div style={{ marginTop: 5, fontSize: 30, fontWeight: 700, color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.95)" }}>
          {ann.labelKm}
        </div>
      </div>
    </>
  );
};

const GlobeLink: React.FC<{
  proj: GeoProjection;
  path: ProjPath;
  ann: LinkAnnotation;
  tSec: number;
}> = ({ proj, path, ann, tSec }) => {
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
  // Great-circle arc that hugs the globe surface, clipped to the near side.
  const arc = path({
    type: "LineString",
    coordinates: [ann.a, ann.b],
  } as never);
  const p2 = projectPoint(proj, ann.b[0], ann.b[1]);
  const pulse = 1 + 0.25 * Math.sin(t * 2 * Math.PI * 1.6);
  return (
    <svg
      width={width}
      height={height}
      style={{
        position: "absolute",
        opacity: fade,
        filter: "drop-shadow(0 0 8px rgba(255,220,60,0.8))",
      }}
    >
      {arc ? (
        <path
          d={arc}
          fill="none"
          stroke="rgba(255,224,70,0.95)"
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - grow * 100}
        />
      ) : null}
      {grow >= 1 && p2 ? (
        <>
          <circle cx={p2.x} cy={p2.y} r={10} fill="rgba(255,224,70,0.95)" />
          <circle cx={p2.x} cy={p2.y} r={26 * pulse} fill="none" stroke="rgba(255,224,70,0.85)" strokeWidth={4} />
        </>
      ) : null}
    </svg>
  );
};

/** The whole video as one continuous spinning 3D globe. */
export const GlobeStage: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const segs = timeline.segments;

  let idx = segs.length - 1;
  for (let k = 0; k < segs.length; k++) {
    if (t < segs[k].endSec) {
      idx = k;
      break;
    }
  }
  const seg = segs[idx];
  const cam = globeCameraAtGlobalTime(segs, t, width, height);
  const proj = makeProjection(cam.lambda, cam.phi, cam.scale, width, height);
  const path = geoPath(proj);

  const localT = t - seg.startSec;
  const fly = idx === 0 ? 0 : flyDurationFor(segs[idx - 1], seg);
  const overlayT = localT - (idx === 0 ? 0 : Math.max(0, fly - 0.8));

  const sphere = path({ type: "Sphere" }) ?? "";
  const grat = path(geoGraticule10()) ?? "";
  const land = path(LAND) ?? "";
  const borders = BORDER_MESH ? path(BORDER_MESH) ?? "" : "";
  const countriesFill = path(COUNTRIES) ?? "";

  // Globe screen geometry for atmosphere + shading.
  const cx = width / 2;
  const cy = height / 2;
  const r = cam.scale;

  return (
    <AbsoluteFill style={{ backgroundColor: "#05070d" }}>
      {/* Atmosphere glow behind the globe */}
      <AbsoluteFill>
        <svg width={width} height={height} style={{ position: "absolute" }}>
          <defs>
            <radialGradient id="atmo" cx="50%" cy="50%" r="50%">
              <stop offset="82%" stopColor="rgba(80,180,255,0)" />
              <stop offset="93%" stopColor="rgba(90,190,255,0.28)" />
              <stop offset="100%" stopColor="rgba(90,190,255,0)" />
            </radialGradient>
            <radialGradient id="ocean" cx="42%" cy="38%" r="72%">
              <stop offset="0%" stopColor="#1c5f86" />
              <stop offset="70%" stopColor="#0d3a58" />
              <stop offset="100%" stopColor="#07223a" />
            </radialGradient>
            <radialGradient id="shade" cx="42%" cy="38%" r="70%">
              <stop offset="60%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
            </radialGradient>
          </defs>
          <circle cx={cx} cy={cy} r={r * 1.16} fill="url(#atmo)" />
        </svg>
      </AbsoluteFill>

      <AbsoluteFill style={{ filter: "saturate(1.1) contrast(1.05)" }}>
        <svg width={width} height={height} style={{ position: "absolute" }}>
          <path d={sphere} fill="url(#ocean)" />
          <path d={grat} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          <path d={countriesFill} fill="#3f6b3a" fillRule="evenodd" />
          <path d={land} fill="none" />
          <path d={borders} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
          {/* limb shading for spherical volume */}
          <path d={sphere} fill="url(#shade)" />
        </svg>
      </AbsoluteFill>

      {seg.rings.length > 0 ? (
        <HighlightOnGlobe proj={proj} path={path} seg={seg} tSec={overlayT} idx={idx} />
      ) : null}
      {(seg.annotations ?? []).map((ann: Annotation, i) =>
        ann.type === "ruler" ? (
          <GlobeRuler key={i} proj={proj} ann={ann} tSec={overlayT} />
        ) : (
          <GlobeLink key={i} proj={proj} path={path} ann={ann} tSec={overlayT} />
        )
      )}
      <GlobeLabel proj={proj} seg={seg} tSec={overlayT} />
    </AbsoluteFill>
  );
};
