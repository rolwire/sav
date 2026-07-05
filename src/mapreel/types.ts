import type { LonLat, Ring, SegmentCamera } from "./geo";

export type HighlightStyle = "flag" | "hatch" | "neon";

/** GeoSolved-style animated distance ruler drawn across a segment's place. */
export interface RulerAnnotation {
  type: "ruler";
  a: LonLat;
  b: LonLat;
  /** seconds after the segment starts */
  startOffsetSec: number;
  labelMi: string;
  labelKm: string;
}

/** A one-shot sound effect cue. */
export interface SfxCue {
  /** staticFile-relative path, e.g. "mapreel/sfx/whoosh.wav" */
  src: string;
  startSec: number;
  volume: number;
}

export interface MapSegment {
  /** Display name shown on the map (e.g. "MOZAMBIQUE") */
  name: string;
  startSec: number;
  endSec: number;
  camera: SegmentCamera;
  /** Simplified polygon outer rings in lon/lat */
  rings: Ring[];
  /**
   * staticFile-relative flag image (e.g. "mapreel/flags/ng.svg").
   * When set, the highlight paints the flag inside the border instead of
   * the default hatch fill.
   */
  flagSrc?: string;
  /** How to fill the highlight: "flag", "hatch" (default), or "neon" —
   *  glowing outline that dims the world outside the border. */
  highlightStyle?: HighlightStyle;
  annotations?: RulerAnnotation[];
}

export interface PhotoCue {
  /** staticFile-relative path, e.g. "mapreel/photos/01.jpg" */
  src: string;
  keyword: string;
  startSec: number;
  durationSec: number;
  side: "left" | "right";
  attribution?: string;
}

export interface CaptionWord {
  text: string;
  startSec: number;
  endSec: number;
}

export interface CaptionGroup {
  startSec: number;
  endSec: number;
  words: CaptionWord[];
}

export interface Timeline {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  /** staticFile-relative audio path, or null for silent preview */
  audioSrc: string | null;
  /** e.g. "mapreel/tiles/{z}/{x}/{y}.png", or null when no tiles present */
  tileTemplate: string | null;
  tileMinZoom: number;
  tileMaxZoom: number;
  segments: MapSegment[];
  photos: PhotoCue[];
  captions: CaptionGroup[];
  sfx: SfxCue[];
  /** Attribution lines shown at the end of the video */
  credits: string[];
}
