export interface AspectSpec {
  name: "9:16" | "16:9";
  width: number;
  height: number;
  /** timeline file under src/mapreel/ */
  timelineFile: string;
  compositionId: string;
}

export const ASPECTS: AspectSpec[] = [
  {
    name: "9:16",
    width: 1080,
    height: 1920,
    timelineFile: "timeline.json",
    compositionId: "MapReel",
  },
  {
    name: "16:9",
    width: 1920,
    height: 1080,
    timelineFile: "timeline-wide.json",
    compositionId: "MapReelWide",
  },
];

/** Parse --aspect: "9:16" (default), "16:9", or "both". */
export const parseAspects = (value: string | boolean | undefined): AspectSpec[] => {
  const v = typeof value === "string" ? value : "9:16";
  if (v === "both") return ASPECTS;
  const found = ASPECTS.find((a) => a.name === v);
  if (!found) {
    throw new Error(`Invalid --aspect "${v}". Use 9:16, 16:9, or both.`);
  }
  return [found];
};
