/**
 * Web-mercator math shared by the render components (src/mapreel) and the
 * asset pipeline (pipeline/). The tile downloader and the <SatelliteMap>
 * component MUST use the same camera + layer functions so every tile that is
 * drawn is guaranteed to have been downloaded.
 */

export type LonLat = [number, number];
export type Ring = LonLat[];

export const TILE_SIZE = 256;

/** Longitude → world unit x in [0, 1] */
export const lonToWorldX = (lon: number): number => (lon + 180) / 360;

/** Latitude → world unit y in [0, 1] (web mercator, y grows southward) */
export const latToWorldY = (lat: number): number => {
  const clamped = Math.max(-85.051, Math.min(85.051, lat));
  const s = Math.sin((clamped * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

export interface Camera {
  lon: number;
  lat: number;
  zoom: number; // fractional zoom; world width in px = TILE_SIZE * 2^zoom
}

/** Project a lon/lat to screen pixels for a given camera and viewport. */
export const project = (
  cam: Camera,
  width: number,
  height: number,
  lon: number,
  lat: number
): { x: number; y: number } => {
  const scale = TILE_SIZE * Math.pow(2, cam.zoom);
  return {
    x: (lonToWorldX(lon) - lonToWorldX(cam.lon)) * scale + width / 2,
    y: (latToWorldY(lat) - latToWorldY(cam.lat)) * scale + height / 2,
  };
};

/** Screen rect (px) of tile (z, x, y) under a camera. */
export const tileScreenRect = (
  cam: Camera,
  width: number,
  height: number,
  z: number,
  x: number,
  y: number
): { left: number; top: number; size: number } => {
  const scale = TILE_SIZE * Math.pow(2, cam.zoom);
  const n = Math.pow(2, z);
  return {
    left: (x / n - lonToWorldX(cam.lon)) * scale + width / 2,
    top: (y / n - latToWorldY(cam.lat)) * scale + height / 2,
    size: (scale / n),
  };
};

export interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Which tiles of integer layer `z` are visible for this camera + viewport. */
export const visibleTiles = (
  cam: Camera,
  width: number,
  height: number,
  z: number,
  padPx = 32
): TileRange => {
  const scale = TILE_SIZE * Math.pow(2, cam.zoom);
  const n = Math.pow(2, z);
  const halfW = (width / 2 + padPx) / scale;
  const halfH = (height / 2 + padPx) / scale;
  const cx = lonToWorldX(cam.lon);
  const cy = latToWorldY(cam.lat);
  const clampTile = (v: number) => Math.max(0, Math.min(n - 1, v));
  return {
    minX: clampTile(Math.floor((cx - halfW) * n)),
    maxX: clampTile(Math.floor((cx + halfW) * n)),
    minY: clampTile(Math.floor((cy - halfH) * n)),
    maxY: clampTile(Math.floor((cy + halfH) * n)),
  };
};

export interface LayerSpec {
  z: number;
  opacity: number;
}

/**
 * Which integer tile layers to draw for a fractional camera zoom.
 * Base layer = floor(zoom) at full opacity; the next layer fades in over the
 * top 65% of the fractional part so the zoom feels continuous.
 */
export const layersForZoom = (
  zoom: number,
  minZ: number,
  maxZ: number
): LayerSpec[] => {
  const base = Math.max(minZ, Math.min(maxZ, Math.floor(zoom)));
  const layers: LayerSpec[] = [{ z: base, opacity: 1 }];
  const frac = zoom - base;
  const t = (frac - 0.35) / 0.65;
  if (t > 0 && base + 1 <= maxZ) {
    layers.push({ z: base + 1, opacity: Math.min(1, t) });
  }
  return layers;
};

export interface SegmentCamera {
  lon: number;
  lat: number;
  zoomStart: number;
  zoomEnd: number;
}

/** Zoom at which a lon/lat bbox fits within `frac` of the viewport. */
export const fitZoom = (
  bbox: [number, number, number, number], // minLon, minLat, maxLon, maxLat
  width: number,
  height: number,
  frac = 0.6
): number => {
  const dx = Math.max(1e-6, lonToWorldX(bbox[2]) - lonToWorldX(bbox[0]));
  const dy = Math.max(1e-6, latToWorldY(bbox[1]) - latToWorldY(bbox[3]));
  const z = Math.log2(
    Math.min((frac * width) / (TILE_SIZE * dx), (frac * height) / (TILE_SIZE * dy))
  );
  return Math.max(2.2, Math.min(9, z));
};

/** Inverse of latToWorldY. */
export const worldYToLat = (wy: number): number =>
  (Math.asin(Math.tanh(2 * Math.PI * (0.5 - wy))) * 180) / Math.PI;

const smoothstep = (x: number): number =>
  x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

// Ken Burns hold: the camera never sits still. It arrives slightly wide of
// the fit zoom and pushes in through it for the whole hold, while the center
// glides a few percent of the viewport in a per-segment direction.
const ARRIVE_BACKOFF = 0.3;
const KB_ZOOM_SPAN = 0.62;
const KB_PAN_FRAC = 0.055;
const GOLDEN_ANGLE = 2.399963;

export interface CameraSegment {
  startSec: number;
  endSec: number;
  camera: SegmentCamera;
}

/**
 * Camera during a segment's hold phase, `h` ∈ [0,1] through the hold.
 * Zoom rises linearly (constant exponential scale rate — the classic slow
 * push), and the center pans through the place at a per-index angle.
 */
const holdCamera = (
  seg: CameraSegment,
  index: number,
  h: number,
  width: number,
  height: number
): { wx: number; wy: number; zoom: number } => {
  const zoom = seg.camera.zoomEnd - ARRIVE_BACKOFF + KB_ZOOM_SPAN * h;
  const viewW = width / (TILE_SIZE * Math.pow(2, seg.camera.zoomEnd));
  const viewH = height / (TILE_SIZE * Math.pow(2, seg.camera.zoomEnd));
  const angle = index * GOLDEN_ANGLE;
  const off = h - 0.5;
  return {
    wx: lonToWorldX(seg.camera.lon) + Math.cos(angle) * viewW * KB_PAN_FRAC * off,
    wy: latToWorldY(seg.camera.lat) + Math.sin(angle) * viewH * KB_PAN_FRAC * off,
    zoom,
  };
};

const toCamera = (s: { wx: number; wy: number; zoom: number }): Camera => ({
  lon: s.wx * 360 - 180,
  lat: worldYToLat(s.wy),
  zoom: s.zoom,
});

/**
 * How long the camera flight into a segment lasts: scales with the mercator
 * distance from the previous place, clamped so short segments still get a
 * decent hold on the destination.
 */
export const flyDurationFor = (
  prev: CameraSegment,
  cur: CameraSegment
): number => {
  const d = Math.hypot(
    lonToWorldX(cur.camera.lon) - lonToWorldX(prev.camera.lon),
    latToWorldY(cur.camera.lat) - latToWorldY(prev.camera.lat)
  );
  const segDur = cur.endSec - cur.startSec;
  return Math.min(Math.max(0.9 + d * 30, 1.2), 2.6, segDur * 0.5);
};

/**
 * One continuous camera path over the whole video, Ken Burns throughout —
 * the camera is never static. The first segment is a zoom-in intro that
 * hands off into the slow push; every later segment starts with a flight
 * from the previous place (centers pan in mercator space while the zoom
 * follows a "zoom out, then back in" arc deep enough to keep both places
 * framable), landing into its own slow push. Shared by the renderer and
 * the tile prefetcher, so drawn tiles are always downloaded.
 */
export const cameraAtGlobalTime = (
  segments: CameraSegment[],
  tSec: number,
  width: number,
  height: number
): Camera => {
  if (segments.length === 0) return { lon: 0, lat: 0, zoom: 2 };
  let i = segments.length - 1;
  for (let k = 0; k < segments.length; k++) {
    if (tSec < segments[k].endSec) {
      i = k;
      break;
    }
  }
  const seg = segments[i];
  const dur = seg.endSec - seg.startSec;
  const t = Math.min(Math.max(tSec - seg.startSec, 0), dur);

  if (i === 0) {
    // Intro: ease from the wide start zoom into the start of the slow push.
    const zoomInDur = Math.max(0.8, Math.min(3.2, dur * 0.55));
    const target = holdCamera(seg, 0, 0, width, height);
    if (t < zoomInDur) {
      const eased = 1 - Math.pow(1 - t / zoomInDur, 3);
      return toCamera({
        wx: target.wx,
        wy: target.wy,
        zoom: seg.camera.zoomStart + (target.zoom - seg.camera.zoomStart) * eased,
      });
    }
    const h = Math.min(1, (t - zoomInDur) / Math.max(0.001, dur - zoomInDur));
    return toCamera(holdCamera(seg, 0, h, width, height));
  }

  const prev = segments[i - 1];
  const fly = flyDurationFor(prev, seg);
  if (t >= fly) {
    const h = Math.min(1, (t - fly) / Math.max(0.001, dur - fly));
    return toCamera(holdCamera(seg, i, h, width, height));
  }

  // Flight: from the end of the previous push to the start of this one.
  const from = holdCamera(prev, i - 1, 1, width, height);
  const to = holdCamera(seg, i, 0, width, height);
  const e = smoothstep(t / fly);

  // Zoom deep enough mid-flight that origin and destination could both fit.
  const d = Math.hypot(to.wx - from.wx, to.wy - from.wy);
  const zBoth =
    d < 1e-9
      ? 12
      : Math.log2((0.45 * Math.min(width, height)) / (TILE_SIZE * d));
  const arcFloor = Math.min(from.zoom, to.zoom, Math.max(1.8, zBoth));
  const bump = Math.max(0, (from.zoom + to.zoom) / 2 - arcFloor);

  return toCamera({
    wx: from.wx + (to.wx - from.wx) * e,
    wy: from.wy + (to.wy - from.wy) * e,
    zoom: from.zoom + (to.zoom - from.zoom) * e - bump * Math.sin(Math.PI * e),
  });
};

/** Great-circle distance between two lon/lat points in km. */
export const haversineKm = (a: LonLat, b: LonLat): number => {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Center of a bbox (naive; antimeridian-spanning bboxes get the wide view). */
export const bboxCenter = (
  bbox: [number, number, number, number]
): { lon: number; lat: number } => ({
  lon: (bbox[0] + bbox[2]) / 2,
  lat: (bbox[1] + bbox[3]) / 2,
});

// ── 3D globe (orthographic) camera ───────────────────────────────────────────
// A globe camera is a rotation (rotate[0]=λ=-lon, rotate[1]=φ=-lat) plus an
// orthographic scale in px. The camera spins the globe to face each place and
// slowly pushes in (Ken Burns) during the hold; between places it eases the
// rotation along the shortest path while dipping the scale so the globe pulls
// back, reads as a spin, then zooms into the next country.

export interface GlobeCamera {
  lambda: number;
  phi: number;
  scale: number;
}

const GLOBE_ARRIVE = 0.92; // arrive slightly pulled back, then push in
const GLOBE_PUSH = 1.14; // total push-in factor across a hold
const GLOBE_DRIFT_DEG = 3; // lon drift across a hold

/** Orthographic scale that frames a mercator `zoom`'s angular span. */
export const globeScaleForZoom = (zoom: number, minDim: number): number => {
  const worldSpan = minDim / (TILE_SIZE * Math.pow(2, zoom));
  const ang = Math.min(Math.PI * 0.96, worldSpan * 2 * Math.PI);
  return minDim / 2 / Math.max(0.03, Math.sin(ang / 2));
};

/** Scale that frames a great-circle span of `angleDeg` (with margin). */
const globeScaleForAngle = (angleDeg: number, minDim: number): number => {
  const ang = Math.min(Math.PI * 0.96, (angleDeg * 1.5 * Math.PI) / 180);
  return minDim / 2 / Math.max(0.03, Math.sin(ang / 2));
};

/** Great-circle angle in degrees between two lon/lat points. */
const angleBetween = (
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number
): number => {
  const toR = Math.PI / 180;
  const c =
    Math.sin(aLat * toR) * Math.sin(bLat * toR) +
    Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.cos((bLon - aLon) * toR);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};

/** Shortest signed angular delta a→b in degrees (wraps at ±180). */
const wrapDeg = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

const globeHold = (
  seg: CameraSegment,
  minDim: number,
  h: number
): GlobeCamera => {
  const base = globeScaleForZoom(seg.camera.zoomEnd, minDim);
  return {
    lambda: -seg.camera.lon + (h - 0.5) * GLOBE_DRIFT_DEG,
    phi: -seg.camera.lat,
    scale: base * (GLOBE_ARRIVE + (GLOBE_PUSH - GLOBE_ARRIVE) * h),
  };
};

/**
 * Continuous globe camera over the whole video. Segment 0 spins + zooms in
 * from a pulled-back globe; later segments spin from the previous place along
 * the shortest rotation while the scale dips (pull back) then pushes into the
 * new country. Ken Burns throughout — never static.
 */
export const globeCameraAtGlobalTime = (
  segments: CameraSegment[],
  tSec: number,
  width: number,
  height: number
): GlobeCamera => {
  const minDim = Math.min(width, height);
  if (segments.length === 0) return { lambda: 0, phi: 0, scale: minDim * 0.45 };

  let i = segments.length - 1;
  for (let k = 0; k < segments.length; k++) {
    if (tSec < segments[k].endSec) {
      i = k;
      break;
    }
  }
  const seg = segments[i];
  const dur = seg.endSec - seg.startSec;
  const t = Math.min(Math.max(tSec - seg.startSec, 0), dur);

  if (i === 0) {
    const target = globeHold(seg, minDim, 0);
    const introDur = Math.max(0.8, Math.min(3.2, dur * 0.55));
    if (t < introDur) {
      const e = 1 - Math.pow(1 - t / introDur, 3);
      return {
        lambda: target.lambda + (1 - e) * 34, // spin ~34° into place
        phi: target.phi,
        scale: minDim * 0.45 + (target.scale - minDim * 0.45) * e,
      };
    }
    const h = Math.min(1, (t - introDur) / Math.max(0.001, dur - introDur));
    return globeHold(seg, minDim, h);
  }

  const prev = segments[i - 1];
  const fly = flyDurationFor(prev, seg);
  if (t >= fly) {
    const h = Math.min(1, (t - fly) / Math.max(0.001, dur - fly));
    return globeHold(seg, minDim, h);
  }

  const from = globeHold(prev, minDim, 1);
  const to = globeHold(seg, minDim, 0);
  const e = smoothstep(t / fly);

  const dAng = angleBetween(prev.camera.lon, prev.camera.lat, seg.camera.lon, seg.camera.lat);
  const dip = globeScaleForAngle(Math.max(dAng, 8), minDim);
  const bump = Math.max(0, (from.scale + to.scale) / 2 - dip);

  return {
    lambda: from.lambda + wrapDeg(to.lambda - from.lambda) * e,
    phi: from.phi + (to.phi - from.phi) * e,
    scale: from.scale + (to.scale - from.scale) * e - bump * Math.sin(Math.PI * e),
  };
};
