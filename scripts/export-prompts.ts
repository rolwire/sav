/**
 * export-prompts.ts
 *
 * Prints all 20 scene prompts as a numbered list ready to paste into
 * any AI image generator (Midjourney, DALL-E 3, Firefly, Stable Diffusion…).
 *
 * Usage:
 *   npx ts-node scripts/export-prompts.ts
 *   npx ts-node scripts/export-prompts.ts > prompts.txt
 */

import { SCENES } from "../src/scenes/sceneData";

for (const scene of SCENES) {
  const durSec = (scene.durationFrames / 30).toFixed(0);
  console.log(
    `\n── Scene ${String(scene.id).padStart(2, "0")}: ${scene.title} (${durSec}s) ──`
  );
  console.log(scene.prompt);
}

console.log(`\nTotal scenes: ${SCENES.length}`);
