/**
 * Offline demo: builds a complete Map Reel timeline with REAL country
 * borders (Natural Earth 110m via the world-atlas package) and REAL flags
 * (flag-icons package) — no network and no VO needed. Only the "satellite"
 * tiles are procedurally colored (real imagery can't be bundled offline).
 *
 *   npm run reel:demo                 # Nigeria → Ghana showcase, 9:16
 *   npm run reel:demo -- --aspect both
 */
import * as fs from "fs";
import * as path from "path";
import { feature } from "topojson-client";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
} from "geojson";
import type { Topology } from "topojson-specification";
import type { Ring } from "../src/mapreel/geo";
import type { PhotoCue } from "../src/mapreel/types";
import type { PlaceHit } from "./analyze";
import { parseAspects } from "./aspects";
import { enumerateTiles } from "./assets";
import { attachFlags } from "./flags";
import { ensureDemoMusic, ensureSfx } from "./sfx";
import { buildTimeline, placesToSegments } from "./timeline";
import type { Word } from "./transcribe";
import { ensureDir, parseArgs } from "./util";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public", "mapreel");
const TIMELINE_DIR = path.join(ROOT, "src", "mapreel");

const FPS = 30;

// ── Real country geometry (Natural Earth 110m) ───────────────────────────────

interface CountryShape {
  name: string;
  rings: Ring[]; // all rings incl. holes, even-odd tested
  bbox: [number, number, number, number];
}

const loadCountries = (): CountryShape[] => {
  const topo = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "node_modules", "world-atlas", "countries-110m.json"),
      "utf8"
    )
  ) as Topology;
  const fc = feature(
    topo,
    topo.objects.countries
  ) as unknown as FeatureCollection<Geometry, { name: string }>;

  const shapes: CountryShape[] = [];
  for (const f of fc.features as Feature<Geometry, { name: string }>[]) {
    const geom = f.geometry;
    if (!geom) continue;
    let polys: number[][][][] = [];
    if (geom.type === "Polygon") polys = [(geom as Polygon).coordinates as number[][][]];
    else if (geom.type === "MultiPolygon")
      polys = (geom as MultiPolygon).coordinates as number[][][][];
    else continue;

    const rings: Ring[] = [];
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const poly of polys) {
      for (const ring of poly) {
        rings.push(ring as Ring);
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lat < minLat) minLat = lat;
          if (lon > maxLon) maxLon = lon;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
    shapes.push({
      name: f.properties?.name ?? "?",
      rings,
      bbox: [minLon, minLat, maxLon, maxLat],
    });
  }
  return shapes;
};

const inRing = (ring: Ring, lon: number, lat: number): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

const inCountry = (c: CountryShape, lon: number, lat: number): boolean => {
  if (lon < c.bbox[0] || lon > c.bbox[2] || lat < c.bbox[1] || lat > c.bbox[3]) {
    return false;
  }
  // Even-odd across all rings handles holes (e.g. Lesotho in South Africa).
  let inside = false;
  for (const ring of c.rings) {
    if (inRing(ring, lon, lat)) inside = !inside;
  }
  return inside;
};

// ── Procedural tile coloring over real coastlines ────────────────────────────

const hash = (a: number, b: number, c: number, d: number): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647 + d * 144665) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
};

const worldYToLat = (wy: number): number =>
  (Math.asin(Math.tanh(2 * Math.PI * (0.5 - wy))) * 180) / Math.PI;

const GRID = 16;
const CELL = 256 / GRID;

const makeTileRenderer = (countries: CountryShape[]) => {
  const isLand = (lon: number, lat: number): boolean =>
    countries.some((c) => inCountry(c, lon, lat));

  return (z: number, x: number, y: number): string => {
    const n = Math.pow(2, z);
    const rects: string[] = [];
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const wx = (x + (i + 0.5) / GRID) / n;
        const wy = (y + (j + 0.5) / GRID) / n;
        const lon = wx * 360 - 180;
        const lat = worldYToLat(wy);
        const land = isLand(lon, lat);
        const h = hash(z, x * GRID + i, y * GRID + j, 7);
        let fill: string | null = null;
        if (land) {
          // Rough Sahara band gets a sandy palette; everything else green.
          const sandy = lat > 16 && lat < 31 && lon > -16 && lon < 36;
          if (sandy) {
            fill = `rgb(${188 + Math.floor(h * 30)},${160 + Math.floor(h * 26)},${104 + Math.floor(h * 22)})`;
          } else {
            const g = 96 + Math.floor(h * 40);
            fill = `rgb(${58 + Math.floor(h * 25)},${g},${52})`;
          }
        } else {
          // Shallow-water rim: any close neighbor sample on land?
          const d = 0.35 / n * 360 / GRID;
          const shallow =
            isLand(lon + d, lat) ||
            isLand(lon - d, lat) ||
            isLand(lon, lat + d) ||
            isLand(lon, lat - d);
          if (shallow) {
            fill = `rgb(23,${88 + Math.floor(h * 20)},${118 + Math.floor(h * 18)})`;
          } else if (h > 0.86) {
            fill = "rgba(255,255,255,0.03)";
          }
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
};

// ── Placeholder photos ────────────────────────────────────────────────────────

const PHOTO_SVGS: Record<string, string> = {
  markets:
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#f6e3c1"/>` +
    `<rect x="120" y="260" width="560" height="240" fill="#b06a2d"/><polygon points="80,260 720,260 660,150 140,150" fill="#d64545"/>` +
    `<rect x="180" y="330" width="90" height="80" fill="#f2b134"/><rect x="320" y="330" width="90" height="80" fill="#7fb069"/>` +
    `<rect x="460" y="330" width="90" height="80" fill="#e2793f"/></svg>`,
  music:
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#2d2a4a"/>` +
    `<circle cx="300" cy="420" r="46" fill="#f2b134"/><rect x="338" y="180" width="16" height="240" fill="#f2b134"/>` +
    `<polygon points="338,180 460,150 460,200 354,228" fill="#f2b134"/><circle cx="560" cy="300" r="90" fill="#d64545"/>` +
    `<circle cx="560" cy="300" r="60" fill="#8a2f2f"/></svg>`,
  cocoa:
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dff0d8"/>` +
    `<ellipse cx="400" cy="330" rx="150" ry="220" fill="#8a5a2d"/><ellipse cx="400" cy="330" rx="150" ry="220" fill="none" stroke="#6b4420" stroke-width="14"/>` +
    `<path d="M330,140 Q400,60 470,140" stroke="#4a7a3a" stroke-width="18" fill="none"/></svg>`,
};

// ── Fixture narration ─────────────────────────────────────────────────────────

const NARRATION =
  "West Africa is home to giants. Nigeria alone holds over two hundred " +
  "million people, its cities alive with music and busy markets. Just west " +
  "along the coast lies Ghana, a nation famous for golden beaches and rich " +
  "cocoa farms. And squeezed right between them sits slim little Benin.";

const makeWords = (): Word[] => {
  const parts = NARRATION.split(/\s+/);
  const step = 0.36;
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

  console.log("Loading Natural Earth country boundaries...");
  const countries = loadCountries();

  const findMention = (name: string): number => {
    const w = words.find((x) => x.text.toLowerCase().startsWith(name.toLowerCase()));
    return w ? w.startSec : 0;
  };

  const demoCountry = (name: string, countryCode: string): PlaceHit => {
    const shape = countries.find((c) => c.name === name);
    if (!shape) throw new Error(`Country "${name}" not found in Natural Earth data`);
    return {
      name,
      displayName: `${name} (Natural Earth 110m)`,
      mentionSec: findMention(name),
      bbox: shape.bbox,
      rings: shape.rings,
      countryCode,
    };
  };

  const places: PlaceHit[] = [
    demoCountry("Nigeria", "ng"),
    demoCountry("Ghana", "gh"),
    demoCountry("Benin", "bj"),
  ];
  attachFlags(places, PUBLIC_DIR);

  console.log("Generating procedural satellite tiles over real coastlines...");
  const renderTileSvg = makeTileRenderer(countries);
  const tilesDir = path.join(PUBLIC_DIR, "tiles");
  const segmentsByAspect = aspects.map((aspect) => ({
    aspect,
    segments: placesToSegments(places, durationSec, aspect.width, aspect.height, {
      rulers: true,
      links: true,
    }).map((s) => {
      // Showcase every look: Nigeria = flag fill, Ghana = solid cyan,
      // Benin = neon outline. Links draw between consecutive places.
      if (s.name === "Ghana") return { ...s, highlightStyle: "solid" as const };
      if (s.name === "Benin") return { ...s, highlightStyle: "neon" as const };
      return s;
    }),
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
      x.text.toLowerCase().startsWith(keyword.slice(0, 5))
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

  const sfx = ensureSfx(PUBLIC_DIR);
  const musicSrc = ensureDemoMusic(PUBLIC_DIR, durationSec);

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
      credits: [
        "Demo mode — borders: Natural Earth · flags: flag-icons · imagery: procedural",
      ],
      sfx,
      musicSrc,
    });
    const timelinePath = path.join(TIMELINE_DIR, aspect.timelineFile);
    fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
    console.log(`Wrote ${path.relative(ROOT, timelinePath)} (${aspect.compositionId})`);
  }
  console.log("Preview with `npm start`, render `npm run reel:render` / `npm run reel:render:wide`.");
};

main();
