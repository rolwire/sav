import type { Ring, SegmentCamera } from "./geo";

export interface MapSegment {
  /** Display name shown on the map (e.g. "MOZAMBIQUE") */
  name: string;
  startSec: number;
  endSec: number;
  camera: SegmentCamera;
  /** Simplified polygon outer rings in lon/lat */
  rings: Ring[];
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
  /** Attribution lines shown at the end of the video */
  credits: string[];
}
