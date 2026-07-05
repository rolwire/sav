import { bboxCenter, fitZoom, haversineKm } from "../src/mapreel/geo";
import type {
  CaptionGroup,
  MapSegment,
  PhotoCue,
  SfxCue,
  Timeline,
} from "../src/mapreel/types";
import type { PlaceHit } from "./analyze";
import type { SfxPaths } from "./sfx";
import type { Word } from "./transcribe";

export interface TimelineOptions {
  fps?: number;
  width?: number;
  height?: number;
  audioSrc: string | null;
  tileTemplate: string | null;
  tileMinZoom?: number;
  tileMaxZoom?: number;
  durationSec: number;
  credits?: string[];
  /** When set, whoosh/pop/ding cues are added automatically. */
  sfx?: SfxPaths | null;
}

export interface SegmentOptions {
  /** Add a GeoSolved-style width ruler to segments long enough to fit one. */
  rulers?: boolean;
}

const RULER_MIN_SEGMENT_SEC = 6;

const MIN_SEGMENT_SEC = 3;

/** Turn geocoded places into back-to-back map segments in spoken order. */
export const placesToSegments = (
  places: PlaceHit[],
  durationSec: number,
  width: number,
  height: number,
  segOpts: SegmentOptions = {}
): MapSegment[] => {
  const segments: MapSegment[] = [];
  const bboxes: [number, number, number, number][] = [];

  for (const place of places) {
    // Start slightly before the place is spoken so the zoom lands on the name.
    const naturalStart = Math.max(0, place.mentionSec - 0.6);
    const start = segments.length === 0
      ? 0
      : Math.max(naturalStart, segments[segments.length - 1].startSec + MIN_SEGMENT_SEC);
    if (start > durationSec - MIN_SEGMENT_SEC) break;

    const center = bboxCenter(place.bbox);
    const zoomEnd = fitZoom(place.bbox, width, height, 0.6);
    segments.push({
      name: place.name,
      startSec: start,
      endSec: durationSec, // provisional; trimmed by the next segment below
      camera: {
        lon: center.lon,
        lat: center.lat,
        zoomStart: Math.max(2, zoomEnd - 2.4),
        zoomEnd,
      },
      rings: place.rings,
      flagSrc: place.flagSrc,
    });
    bboxes.push(place.bbox);
    if (segments.length >= 2) {
      segments[segments.length - 2].endSec = start;
    }
  }

  if (segOpts.rulers) {
    segments.forEach((seg, i) => {
      if (seg.endSec - seg.startSec < RULER_MIN_SEGMENT_SEC) return;
      const bbox = bboxes[i];
      // Lower third of the shape, so the ruler doesn't cross the place label.
      const rulerLat = bbox[1] + (bbox[3] - bbox[1]) * 0.3;
      const a: [number, number] = [bbox[0], rulerLat];
      const b: [number, number] = [bbox[2], rulerLat];
      const km = haversineKm(a, b);
      if (km < 1) return;
      const mi = km * 0.621371;
      seg.annotations = [
        {
          type: "ruler",
          a,
          b,
          startOffsetSec: 3.2,
          labelMi: `${Math.round(mi).toLocaleString("en-US")} miles`,
          labelKm: `${Math.round(km).toLocaleString("en-US")} km`,
        },
      ];
    });
  }

  return segments;
};

/** Group words into short caption chunks (≤4 words / ≤1.8s / sentence ends). */
export const wordsToCaptions = (words: Word[]): CaptionGroup[] => {
  const groups: CaptionGroup[] = [];
  let current: CaptionGroup | null = null;

  for (const w of words) {
    const startNew =
      !current ||
      current.words.length >= 4 ||
      w.startSec - current.endSec > 0.6 ||
      w.startSec - current.startSec > 1.8;
    if (startNew) {
      if (current) groups.push(current);
      current = { startSec: w.startSec, endSec: w.endSec, words: [] };
    }
    current!.words.push({ text: w.text, startSec: w.startSec, endSec: w.endSec });
    current!.endSec = w.endSec;
    if (/[.!?]$/.test(w.text)) {
      groups.push(current!);
      current = null;
    }
  }
  if (current) groups.push(current);

  // Keep each group on screen until the next one starts (no flicker gaps).
  for (let i = 0; i < groups.length - 1; i++) {
    groups[i].endSec = Math.max(groups[i].endSec, groups[i + 1].startSec);
  }
  return groups;
};

/** Build whoosh/pop/ding cues from what happens on screen. */
const buildSfxCues = (
  segments: MapSegment[],
  photos: PhotoCue[],
  sfx: SfxPaths
): SfxCue[] => {
  const cues: SfxCue[] = [];
  segments.forEach((seg, i) => {
    cues.push({
      src: sfx.whoosh,
      startSec: Math.max(0, seg.startSec - (i > 0 ? 0.2 : 0)),
      volume: 0.5,
    });
    cues.push({ src: sfx.ding, startSec: seg.startSec + 1.7, volume: 0.35 });
    for (const ann of seg.annotations ?? []) {
      cues.push({
        src: sfx.pop,
        startSec: seg.startSec + ann.startOffsetSec,
        volume: 0.3,
      });
    }
  });
  for (const p of photos) {
    cues.push({ src: sfx.pop, startSec: p.startSec, volume: 0.55 });
  }
  return cues.sort((a, b) => a.startSec - b.startSec);
};

export const buildTimeline = (
  words: Word[],
  segments: MapSegment[],
  photos: PhotoCue[],
  opts: TimelineOptions
): Timeline => {
  const fps = opts.fps ?? 30;
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1920;

  return {
    fps,
    width,
    height,
    durationInFrames: Math.round(opts.durationSec * fps),
    audioSrc: opts.audioSrc,
    tileTemplate: opts.tileTemplate,
    tileMinZoom: opts.tileMinZoom ?? 2,
    tileMaxZoom: opts.tileMaxZoom ?? 12,
    segments,
    photos,
    captions: wordsToCaptions(words),
    sfx: opts.sfx ? buildSfxCues(segments, photos, opts.sfx) : [],
    credits: opts.credits ?? [],
  };
};
