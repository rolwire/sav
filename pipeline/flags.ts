import * as fs from "fs";
import * as path from "path";
import type { PlaceHit } from "./analyze";
import { ensureDir } from "./util";

/**
 * Attach flag images to country places. Flags come from the bundled
 * `flag-icons` npm package (all ISO 3166-1 countries, SVG, offline) and are
 * copied into public/mapreel/flags/ so Remotion can serve them.
 */
export const attachFlags = (places: PlaceHit[], publicDir: string): void => {
  const flagsDir = path.join(publicDir, "flags");
  for (const place of places) {
    if (!place.countryCode) continue;
    const src = path.join(
      process.cwd(),
      "node_modules",
      "flag-icons",
      "flags",
      "4x3",
      `${place.countryCode}.svg`
    );
    if (!fs.existsSync(src)) {
      console.warn(`  no flag found for country code "${place.countryCode}"`);
      continue;
    }
    ensureDir(flagsDir);
    const dest = path.join(flagsDir, `${place.countryCode}.svg`);
    fs.copyFileSync(src, dest);
    place.flagSrc = `mapreel/flags/${place.countryCode}.svg`;
    console.log(`  flag: ${place.name} -> ${place.countryCode}.svg`);
  }
};
