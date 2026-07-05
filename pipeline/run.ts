/**
 * Map Reel pipeline — voiceover in, GeoBites-style map video out.
 *
 * Usage:
 *   npm run reel -- --vo path/to/voiceover.mp3
 *
 * Options:
 *   --vo <file>          Voiceover audio (mp3/wav/m4a...) — the only required input
 *   --transcript <file>  Skip whisper; use this transcript (Word[] JSON or whisper.cpp JSON)
 *   --places "A,B,C"     Skip place detection; use these places in this order
 *   --model <name>       Whisper model (default base.en; try medium.en for accuracy)
 *   --max-photos <n>     Max keyword photos (default 8)
 *   --no-photos          Skip photo fetching
 *
 * Then render with: npm run reel:render
 */
import * as fs from "fs";
import * as path from "path";
import { extractPlaces, pickPhotoKeywords } from "./analyze";
import { downloadTiles, fetchPhotos, photosToCues } from "./assets";
import { buildTimeline, placesToSegments } from "./timeline";
import { audioDurationSec, loadTranscript, transcribeVO, Word } from "./transcribe";
import { ensureDir, parseArgs } from "./util";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public", "mapreel");
const TIMELINE_PATH = path.join(ROOT, "src", "mapreel", "timeline.json");

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const voPath = args.vo as string;
  if (!voPath || typeof voPath !== "string") {
    console.error("Missing --vo <audio file>. See pipeline/run.ts header for usage.");
    process.exit(1);
  }
  if (!fs.existsSync(voPath)) {
    console.error(`Voiceover file not found: ${voPath}`);
    process.exit(1);
  }

  // ── 1. Transcribe ─────────────────────────────────────────────────────────
  console.log("\n[1/5] Transcribing voiceover...");
  let words: Word[];
  if (typeof args.transcript === "string") {
    words = loadTranscript(args.transcript);
    console.log(`  loaded ${words.length} words from ${args.transcript}`);
  } else {
    words = await transcribeVO(voPath, (args.model as string) || "base.en");
    console.log(`  transcribed ${words.length} words`);
  }
  if (words.length === 0) {
    console.error("Transcript is empty — is the VO audible speech?");
    process.exit(1);
  }

  const durationSec =
    (audioDurationSec(voPath) ?? words[words.length - 1].endSec + 1.5) + 0.5;

  // ── 2. Detect places ──────────────────────────────────────────────────────
  console.log("\n[2/5] Detecting places (OpenStreetMap Nominatim)...");
  const overrides =
    typeof args.places === "string"
      ? args.places.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
  const places = await extractPlaces(words, overrides);
  if (places.length === 0) {
    console.error(
      "No places found in the VO. Name places explicitly, or pass --places \"Egypt, Nile\""
    );
    process.exit(1);
  }
  const segments = placesToSegments(places, durationSec, WIDTH, HEIGHT);
  console.log(`  ${segments.length} map segments: ${segments.map((s) => s.name).join(" → ")}`);

  // ── 3. Satellite tiles ────────────────────────────────────────────────────
  console.log("\n[3/5] Downloading satellite tiles (Esri World Imagery)...");
  const tilesDir = path.join(PUBLIC_DIR, "tiles");
  ensureDir(tilesDir);
  const tileMinZoom = 2;
  const tileMaxZoom = 12;
  await downloadTiles(
    segments,
    { width: WIDTH, height: HEIGHT, fps: FPS, minZoom: tileMinZoom, maxZoom: tileMaxZoom },
    tilesDir
  );

  // ── 4. Keyword photos ─────────────────────────────────────────────────────
  let photoCues = [] as ReturnType<typeof photosToCues>;
  if (args["no-photos"]) {
    console.log("\n[4/5] Skipping photos (--no-photos)");
  } else {
    console.log("\n[4/5] Fetching keyword photos (Wikimedia Commons / Openverse)...");
    const maxPhotos = parseInt((args["max-photos"] as string) || "8", 10);
    const keywords = pickPhotoKeywords(words, places, maxPhotos);
    console.log(`  keywords: ${keywords.map((k) => k.keyword).join(", ") || "(none)"}`);
    const photos = await fetchPhotos(keywords, path.join(PUBLIC_DIR, "photos"));
    photoCues = photosToCues(photos, durationSec, "mapreel");
  }

  // ── 5. Timeline ───────────────────────────────────────────────────────────
  console.log("\n[5/5] Building timeline...");
  ensureDir(PUBLIC_DIR);
  const voDest = path.join(PUBLIC_DIR, `vo${path.extname(voPath) || ".mp3"}`);
  fs.copyFileSync(voPath, voDest);

  const credits = [
    "Imagery © Esri World Imagery · Map data © OpenStreetMap contributors",
    ...new Set(photoCues.map((p) => `Photo: ${p.attribution}`).filter(Boolean)),
  ].slice(0, 5) as string[];

  const timeline = buildTimeline(words, segments, photoCues, {
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    durationSec,
    audioSrc: `mapreel/${path.basename(voDest)}`,
    tileTemplate: "mapreel/tiles/{z}/{x}/{y}.jpg",
    tileMinZoom,
    tileMaxZoom,
    credits,
  });

  fs.writeFileSync(TIMELINE_PATH, JSON.stringify(timeline, null, 2));
  console.log(`  wrote ${path.relative(ROOT, TIMELINE_PATH)}`);
  console.log(
    `\nDone. Preview with \`npm start\` (MapReel composition) or render with \`npm run reel:render\`.`
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
