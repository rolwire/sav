/** Returns the frame offset for each scene (accounting for the 2-second title card). */
import { SCENES } from "../scenes/sceneData";

const TITLE_DURATION = 60;

export function getSceneOffsets(): { id: number; from: number; to: number }[] {
  const result: { id: number; from: number; to: number }[] = [];
  let cursor = TITLE_DURATION;
  for (const scene of SCENES) {
    result.push({ id: scene.id, from: cursor, to: cursor + scene.durationFrames - 1 });
    cursor += scene.durationFrames;
  }
  return result;
}

export function getTimecodeFromFrame(frame: number, fps = 30): string {
  const totalSeconds = Math.floor(frame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = frame % fps;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

export function printTimingSheet(): void {
  const offsets = getSceneOffsets();
  console.log("\n=== ARK OF THE COVENANT — Timing Sheet (30fps) ===\n");
  for (const o of offsets) {
    const scene = SCENES.find((s) => s.id === o.id)!;
    const durationSec = (scene.durationFrames / 30).toFixed(0);
    console.log(
      `Scene ${String(o.id).padStart(2, "0")}  [${getTimecodeFromFrame(o.from)} → ${getTimecodeFromFrame(o.to)}]  ${durationSec}s  "${scene.title}"`
    );
  }
  console.log(`\nTotal frames: ${offsets[offsets.length - 1].to + 1}`);
}
