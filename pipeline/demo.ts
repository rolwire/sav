/**
 * Offline demo: builds a complete Map Reel timeline with procedurally
 * generated "satellite" tiles and placeholder photos — no network, no VO
 * needed. Lets you preview the whole composition before running the real
 * pipeline:  npm run reel:demo  then  npm start
 */
import * as fs from "fs";
import * as path from "path";
import { latToWorldY, lonToWorldX, Ring } from "../src/mapreel/geo";
import type { PhotoCue } from "../src/mapreel/types";
import type { PlaceHit } from "./analyze";
import { parseAspects } from "./aspects";
import { enumerateTiles } from "./assets";
import { buildTimeline, placesToSegments } from "./timeline";
import type { Word } from "./transcribe";
import { ensureDir, parseArgs } from "./util";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public", "mapreel");
const TIMELINE_DIR = path.join(ROOT, "src", "mapreel");

const FPS = 30;

// ── Fictional geography ───────────────────────────────────────────────────────
// Islands defined in world (mercator) coordinates. The same wobble function
// shapes both the land in the tiles and the highlight polygon, so they match.

interface Blob {
  cx: number; // world x
  cy: number; // world y
  rx: number;
  ry: number;
  wobbleAmp: number;
  wobbleFreq: number;
  phase: number;
}

const ISLA_VERDE: Blob = {
  cx: lonToWorldX(-30),
  cy: latToWorldY(21),
  rx: 1.4 / 360,
  ry: 1.1 / 360,
  wobbleAmp: 0.3,
  wobbleFreq: 5,
  phase: 1.3,
};

const BAHIA_AZUL: Blob = {
  cx: lonToWorldX(-27.6),
  cy: latToWorldY(19.4),
  rx: 0.75 / 360,
  ry: 0.6 / 360,
  wobbleAmp: 0.35,
  wobbleFreq: 4,
  phase: 4.1,
};

// Background landmasses so wide shots aren't empty ocean.
const SCENERY: Blob[] = [
  { cx: lonToWorldX(-52), cy: latToWorldY(34), rx: 0.018, ry: 0.014, wobbleAmp: 0.4, wobbleFreq: 3, phase: 0.7 },
  { cx: lonToWorldX(-9), cy: latToWorldY(9), rx: 0.016, ry: 0.02, wobbleAmp: 0.35, wobbleFreq: 4, phase: 2.9 },
  { cx: lonToWorldX(-40), cy: latToWorldY(2), rx: 0.012, ry: 0.012, wobbleAmp: 0.45, wobbleFreq: 5, phase: 5.2 },
];

const ALL_BLOBS = [ISLA_VERDE, BAHIA_AZUL, ...SCENERY];

const edgeR = (b: Blob, ang: number): number =>
  1 + b.wobbleAmp * Math.sin(b.wobbleFreq * ang + b.phase);

const insideBlob = (b: Blob, wx: number, wy: number, scale = 1): boolean => {
  const dx = (wx - b.cx) / b.rx;
  const dy = (wy - b.cy) / b.ry;
  const r = Math.hypot(dx, dy);
  return r < edgeR(b, Math.atan2(dy, dx)) * scale;
};

const worldYToLat = (wy: number): number =>
  (Math.asin(Math.tanh(2 * Math.PI * (0.5 - wy))) * 180) / Math.PI;

const blobRing = (b: Blob, points = 72): Ring => {
  const ring: Ring = [];
  for (let i = 0; i <= points; i++) {
    const ang = (i / points) * 2 * Math.PI;
    const r = edgeR(b, ang);
    const wx = b.cx + b.rx * r * Math.cos(ang);
    const wy = b.cy + b.ry * r * Math.sin(ang);
    ring.push([wx * 360 - 180, worldYToLat(wy)]);
  }
  return ring;
};

const blobBbox = (b: Blob): [number, number, number, number] => {
  const m = 1 + b.wobbleAmp;
  return [
    (b.cx - b.rx * m) * 360 - 180,
    worldYToLat(b.cy + b.ry * m),
    (b.cx + b.rx * m) * 360 - 180,
    worldYToLat(b.cy - b.ry * m),
  ];
};

// ── Procedural tile rendering ────────────────────────────────────────────────

const hash = (a: number, b: number, c: number, d: number): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647 + d * 144665) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
};

const GRID = 16;
const CELL = 256 / GRID;

const renderTileSvg = (z: number, x: number, y: number): string => {
  const n = Math.pow(2, z);
  const rects: string[] = [];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const wx = (x + (i + 0.5) / GRID) / n;
      const wy = (y + (j + 0.5) / GRID) / n;
      const land = ALL_BLOBS.some((b) => insideBlob(b, wx, wy));
      const shallow = !land && ALL_BLOBS.some((b) => insideBlob(b, wx, wy, 1.25));
      const h = hash(z, x * GRID + i, y * GRID + j, 7);
      let fill: string | null = null;
      if (land) {
        const g = 96 + Math.floor(h * 40);
        fill = `rgb(${58 + Math.floor(h * 25)},${g},${52})`;
      } else if (shallow) {
        fill = `rgb(23,${88 + Math.floor(h * 20)},${118 + Math.floor(h * 18)})`;
      } else if (h > 0.86) {
        fill = "rgba(255,255,255,0.03)"; // faint ocean texture
      }
      if (fill) {
        rects.push(
          `<rect x="${i * CELL}" y="${j * CELL}" width="${CELL}" height="${CELL}" fill="${fill}"/>`
        );
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">` +
    `<rect width="256" height="256" fill="#0b3550"/>` +
    rects.join("") +
    `</svg>`
  );
};

const PHOTO_SVGS: Record<string, string> = {
  volcano:
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ffd9a0"/>` +
    `<circle cx="640" cy="120" r="70" fill="#ff9e45"/><polygon points="150,600 400,180 650,600" fill="#5a4636"/>` +
    `<polygon points="330,300 400,180 470,300 430,270 400,300 370,270" fill="#e05a33"/></svg>`,
  lighthouse:
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#bfe3f0"/>` +
    `<rect y="440" width="800" height="160" fill="#2a6f8e"/><polygon points="360,440 440,440 425,160 375,160" fill="#e8e4da"/>` +
    `<rect x="368" y="250" width="64" height="40" fill="#c33"/><rect x="380" y="120" width="40" height="45" fill="#ffe08a"/>` +
    `<polygon points="370,120 430,120 400,85" fill="#444"/></svg>`,
  "fishing boats":
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#9fd4e8"/>` +
    `<rect y="380" width="800" height="220" fill="#1f6d94"/><path d="M200,420 L390,420 L360,480 L230,480 Z" fill="#7a4b2a"/>` +
    `<rect x="288" y="300" width="12" height="122" fill="#5a3a20"/><polygon points="300,305 300,405 380,405" fill="#f3ecd9"/>` +
    `<path d="M480,440 L640,440 L615,488 L505,488 Z" fill="#8a5a35"/></svg>`,
};

// ── Fixture narration ─────────────────────────────────────────────────────────

const NARRATION =
  "Hidden deep in the mid Atlantic lies Isla Verde. A volcanic island ringed " +
  "by turquoise reefs and black sand beaches. Just to the south sits tiny " +
  "Bahia Azul. Its old lighthouse has guided fishing boats home for over two " +
  "hundred years.";

const makeWords = (): Word[] => {
  const parts = NARRATION.split(/\s+/);
  const step = 0.34;
  return parts.map((text, i) => ({
    text,
    startSec: 0.4 + i * step,
    endSec: 0.4 + (i + 1) * step - 0.04,
  }));
};

// ── Build everything ──────────────────────────────────────────────────────────

const main = (): void => {
  const args = parseArgs(process.argv.slice(2));
  const aspects = parseAspects(args.aspect);
  const words = makeWords();
  const durationSec = words[words.length - 1].endSec + 2.5;

  const findMention = (name: string): number => {
    const first = name.split(/\s+/)[0].toLowerCase();
    const w = words.find((x) => x.text.toLowerCase().startsWith(first));
    return w ? w.startSec : 0;
  };

  const places: PlaceHit[] = [
    {
      name: "Isla Verde",
      displayName: "Isla Verde (demo)",
      mentionSec: findMention("Isla"),
      bbox: blobBbox(ISLA_VERDE),
      rings: [blobRing(ISLA_VERDE)],
    },
    {
      name: "Bahia Azul",
      displayName: "Bahia Azul (demo)",
      mentionSec: findMention("Bahia"),
      bbox: blobBbox(BAHIA_AZUL),
      rings: [blobRing(BAHIA_AZUL)],
    },
  ];

  console.log("Generating procedural satellite tiles...");
  const tilesDir = path.join(PUBLIC_DIR, "tiles");
  const segmentsByAspect = aspects.map((aspect) => ({
    aspect,
    segments: placesToSegments(places, durationSec, aspect.width, aspect.height),
  }));
  for (const { aspect, segments } of segmentsByAspect) {
    const tileCfg = {
      width: aspect.width,
      height: aspect.height,
      fps: FPS,
      minZoom: 2,
      maxZoom: 9,
    };
    const tiles = enumerateTiles(segments, tileCfg);
    for (const t of tiles) {
      const dir = path.join(tilesDir, String(t.z), String(t.x));
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, `${t.y}.svg`), renderTileSvg(t.z, t.x, t.y));
    }
    console.log(`  ${aspect.name}: wrote ${tiles.length} tiles`);
  }

  console.log("Generating placeholder photos...");
  const photosDir = path.join(PUBLIC_DIR, "photos");
  ensureDir(photosDir);
  const photoCues: PhotoCue[] = [];
  let side: "left" | "right" = "left";
  for (const [keyword, svg] of Object.entries(PHOTO_SVGS)) {
    const file = `${keyword.replace(/\s+/g, "-")}.svg`;
    fs.writeFileSync(path.join(photosDir, file), svg);
    const w = words.find((x) =>
      x.text.toLowerCase().startsWith(keyword.split(/\s+/)[0].slice(0, 6))
    );
    if (!w) continue;
    photoCues.push({
      src: `mapreel/photos/${file}`,
      keyword,
      startSec: w.startSec,
      durationSec: 3,
      side,
      attribution: "demo placeholder",
    });
    side = side === "left" ? "right" : "left";
  }

  for (const { aspect, segments } of segmentsByAspect) {
    const timeline = buildTimeline(words, segments, photoCues, {
      fps: FPS,
      width: aspect.width,
      height: aspect.height,
      durationSec,
      audioSrc: null,
      tileTemplate: "mapreel/tiles/{z}/{x}/{y}.svg",
      tileMinZoom: 2,
      tileMaxZoom: 9,
      credits: ["Demo mode — all map imagery procedurally generated"],
    });
    const timelinePath = path.join(TIMELINE_DIR, aspect.timelineFile);
    fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
    console.log(`Wrote ${path.relative(ROOT, timelinePath)} (${aspect.compositionId})`);
  }
  console.log("Preview with `npm start`, render `npm run reel:render` / `npm run reel:render:wide`.");
};

main();
