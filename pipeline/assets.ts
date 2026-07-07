import * as path from "path";
import {
  cameraAtGlobalTime,
  layersForZoom,
  visibleTiles,
} from "../src/mapreel/geo";
import type { MapSegment, PhotoCue } from "../src/mapreel/types";
import type { PhotoKeyword } from "./analyze";
import { downloadFile, fetchJson, pool, sleep, stripHtml } from "./util";

export interface TileConfig {
  width: number;
  height: number;
  fps: number;
  minZoom: number;
  maxZoom: number;
}

export interface TileId {
  z: number;
  x: number;
  y: number;
}

/**
 * Enumerate every tile the renderer will draw for these segments, by sampling
 * the exact same camera path + layer rules the <SatelliteMap> component uses.
 */
export const enumerateTiles = (
  segments: MapSegment[],
  cfg: TileConfig
): TileId[] => {
  const set = new Set<string>();

  // Sample the continuous global camera path at every frame — the exact
  // time grid the renderer evaluates — so flight paths between places are
  // fully covered, and no layer-threshold crossing can slip between samples.
  const totalSec = segments[segments.length - 1]?.endSec ?? 0;
  const frames = Math.ceil(totalSec * cfg.fps) + 1;
  for (let f = 0; f <= frames; f++) {
    const cam = cameraAtGlobalTime(segments, f / cfg.fps, cfg.width, cfg.height);
    for (const layer of layersForZoom(cam.zoom, cfg.minZoom, cfg.maxZoom)) {
      const range = visibleTiles(cam, cfg.width, cfg.height, layer.z, 96);
      for (let x = range.minX; x <= range.maxX; x++) {
        for (let y = range.minY; y <= range.maxY; y++) {
          set.add(`${layer.z}/${x}/${y}`);
        }
      }
    }
  }

  return [...set].map((k) => {
    const [z, x, y] = k.split("/").map(Number);
    return { z, x, y };
  });
};

const ESRI_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Download all needed Esri World Imagery satellite tiles to `tilesDir`. */
export const downloadTiles = async (
  segments: MapSegment[],
  cfg: TileConfig,
  tilesDir: string
): Promise<void> => {
  const tiles = enumerateTiles(segments, cfg);
  console.log(`  ${tiles.length} satellite tiles needed`);
  if (tiles.length > 4000) {
    console.warn(
      "  warning: very large tile count — consider fewer places or a shorter video"
    );
  }
  let done = 0;
  await pool(tiles, 8, async (t) => {
    const url = ESRI_TILE_URL.replace("{z}", String(t.z))
      .replace("{y}", String(t.y))
      .replace("{x}", String(t.x));
    await downloadFile(url, path.join(tilesDir, String(t.z), String(t.x), `${t.y}.jpg`));
    done++;
    if (done % 100 === 0) console.log(`  ${done}/${tiles.length} tiles`);
  });
};

interface CommonsImageInfo {
  thumburl?: string;
  url?: string;
  extmetadata?: {
    Artist?: { value: string };
    LicenseShortName?: { value: string };
  };
}
interface CommonsResponse {
  query?: {
    pages?: Record<
      string,
      { title: string; imageinfo?: CommonsImageInfo[]; index?: number }
    >;
  };
}

interface OpenverseResponse {
  results: { url: string; creator?: string; license?: string; title?: string }[];
}

export interface FetchedPhoto {
  keyword: string;
  startSec: number;
  file: string; // path relative to photosDir parent, e.g. "photos/01.jpg"
  attribution: string;
}

const extFromUrl = (url: string): string => {
  const m = url.match(/\.(jpe?g|png|webp)(\?|$)/i);
  return m ? `.${m[1].toLowerCase()}` : ".jpg";
};

const searchCommons = async (
  keyword: string
): Promise<{ url: string; attribution: string } | null> => {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: `filetype:bitmap ${keyword}`,
      gsrnamespace: "6",
      gsrlimit: "5",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "1400",
    }).toString();

  const data = await fetchJson<CommonsResponse>(url);
  const pages = Object.values(data.query?.pages ?? {}).sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const src = info?.thumburl ?? info?.url;
    if (!src || !/\.(jpe?g|png)/i.test(src)) continue;
    const artist = info?.extmetadata?.Artist?.value
      ? stripHtml(info.extmetadata.Artist.value)
      : "unknown";
    const license = info?.extmetadata?.LicenseShortName?.value ?? "";
    return {
      url: src,
      attribution: `${artist}${license ? ` (${license})` : ""} via Wikimedia Commons`,
    };
  }
  return null;
};

const searchOpenverse = async (
  keyword: string
): Promise<{ url: string; attribution: string } | null> => {
  const url =
    "https://api.openverse.org/v1/images/?" +
    new URLSearchParams({ q: keyword, page_size: "5" }).toString();
  const data = await fetchJson<OpenverseResponse>(url);
  const hit = data.results?.find((r) => r.url);
  if (!hit) return null;
  return {
    url: hit.url,
    attribution: `${hit.creator ?? "unknown"} (${(hit.license ?? "cc").toUpperCase()}) via Openverse`,
  };
};

/**
 * For each keyword, find a real openly-licensed photo (Wikimedia Commons
 * first, Openverse as fallback) and download it.
 */
export const fetchPhotos = async (
  keywords: PhotoKeyword[],
  photosDir: string
): Promise<FetchedPhoto[]> => {
  const out: FetchedPhoto[] = [];
  let n = 0;
  for (const kw of keywords) {
    let hit: { url: string; attribution: string } | null = null;
    try {
      hit = await searchCommons(kw.keyword);
    } catch (err) {
      console.warn(`  commons search failed for "${kw.keyword}": ${err}`);
    }
    if (!hit) {
      try {
        hit = await searchOpenverse(kw.keyword);
      } catch (err) {
        console.warn(`  openverse search failed for "${kw.keyword}": ${err}`);
      }
    }
    await sleep(400);
    if (!hit) {
      console.warn(`  no photo found for "${kw.keyword}" — skipping`);
      continue;
    }
    n++;
    const fileName = `${String(n).padStart(2, "0")}${extFromUrl(hit.url)}`;
    try {
      await downloadFile(hit.url, path.join(photosDir, fileName));
    } catch (err) {
      console.warn(`  photo download failed for "${kw.keyword}": ${err}`);
      continue;
    }
    console.log(`  photo: "${kw.keyword}" -> ${fileName}`);
    out.push({
      keyword: kw.keyword,
      startSec: kw.startSec,
      file: `photos/${fileName}`,
      attribution: hit.attribution,
    });
  }
  return out;
};

/** Convert fetched photos into timeline cues, alternating screen sides. */
export const photosToCues = (
  photos: FetchedPhoto[],
  durationSec: number,
  assetPrefix: string
): PhotoCue[] =>
  photos
    .filter((p) => p.startSec < durationSec - 2)
    .map((p, i) => ({
      src: `${assetPrefix}/${p.file}`,
      keyword: p.keyword,
      startSec: p.startSec,
      durationSec: Math.min(3, durationSec - p.startSec - 0.5),
      side: i % 2 === 0 ? ("left" as const) : ("right" as const),
      attribution: p.attribution,
    }));
