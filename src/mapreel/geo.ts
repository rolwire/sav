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

/**
 * Deterministic camera path within a map segment: a cubic ease-out zoom-in
 * over the first ~3s, then a slow forward drift for the rest of the segment.
 * Shared by the component (per frame) and the tile prefetcher (sampled).
 */
export const cameraAtTime = (
  cam: SegmentCamera,
  tSec: number,
  segDurSec: number
): Camera => {
  const zoomInDur = Math.max(0.8, Math.min(3.2, segDurSec * 0.55));
  const p = Math.max(0, Math.min(1, tSec / zoomInDur));
  const eased = 1 - Math.pow(1 - p, 3);
  let zoom = cam.zoomStart + (cam.zoomEnd - cam.zoomStart) * eased;
  const driftSpan = Math.max(0.001, segDurSec - zoomInDur);
  const drift = Math.max(0, Math.min(1, (tSec - zoomInDur) / driftSpan));
  zoom += drift * 0.14;
  return { lon: cam.lon, lat: cam.lat, zoom };
};

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

/** Post-arrival forward drift added over the hold portion of a segment. */
const DRIFT = 0.14;

export interface CameraSegment {
  startSec: number;
  endSec: number;
  camera: SegmentCamera;
}

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
 * One continuous camera path over the whole video. The first segment is the
 * classic zoom-in intro; every later segment starts with a flight from the
 * previous place: centers pan in mercator space while the zoom follows a
 * "zoom out, then back in" arc deep enough to keep both places framable —
 * far hops zoom way out, neighbors barely at all. Shared by the renderer
 * and the tile prefetcher, so drawn tiles are always downloaded.
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

  if (i === 0) return cameraAtTime(seg.camera, t, dur);

  const prev = segments[i - 1];
  const fly = flyDurationFor(prev, seg);
  if (t >= fly) {
    const hold = Math.min(1, (t - fly) / Math.max(0.001, dur - fly));
    return {
      lon: seg.camera.lon,
      lat: seg.camera.lat,
      zoom: seg.camera.zoomEnd + DRIFT * hold,
    };
  }

  const e = smoothstep(t / fly);
  const x1 = lonToWorldX(prev.camera.lon);
  const y1 = latToWorldY(prev.camera.lat);
  const x2 = lonToWorldX(seg.camera.lon);
  const y2 = latToWorldY(seg.camera.lat);
  const z1 = prev.camera.zoomEnd + DRIFT;
  const z2 = seg.camera.zoomEnd;

  // Zoom deep enough mid-flight that origin and destination could both fit.
  const d = Math.hypot(x2 - x1, y2 - y1);
  const zBoth =
    d < 1e-9
      ? 12
      : Math.log2((0.45 * Math.min(width, height)) / (TILE_SIZE * d));
  const arcFloor = Math.min(z1, z2, Math.max(1.8, zBoth));
  const bump = Math.max(0, (z1 + z2) / 2 - arcFloor);
  const zoom = z1 + (z2 - z1) * e - bump * Math.sin(Math.PI * e);

  const wx = x1 + (x2 - x1) * e;
  const wy = y1 + (y2 - y1) * e;
  return { lon: wx * 360 - 180, lat: worldYToLat(wy), zoom };
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
