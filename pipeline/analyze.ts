import type { Ring } from "../src/mapreel/geo";
import { fetchJson, sleep } from "./util";
import type { Word } from "./transcribe";

export interface PlaceHit {
  name: string;
  displayName: string;
  mentionSec: number;
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
  rings: Ring[];
  /** ISO 3166-1 alpha-2, set when the place is a country (for flag painting) */
  countryCode?: string;
  /** staticFile-relative flag image, filled in by the flag step */
  flagSrc?: string;
}

export interface PhotoKeyword {
  keyword: string;
  startSec: number;
}

const STOPWORDS = new Set(
  (
    "a an the and or but so now then here there this that these those it its is are was were be been " +
    "being have has had do does did will would can could should may might must in on at by for with " +
    "about against between into through during before after above below to from up down out off over " +
    "under again once i you he she we they them his her our your their my me him us what which who whom " +
    "when where why how all any both each few more most other some such no nor not only own same than " +
    "too very just also ever never even still yet if because while of as let meet welcome today imagine " +
    "picture look listen well okay right left new old big small first second third one two three four " +
    "five six seven eight nine ten hundred thousand million billion percent"
  ).split(/\s+/)
);

const cleanWord = (w: string): string => w.replace(/[^\p{L}\p{N}'’-]/gu, "");
const isCapitalized = (w: string): boolean => /^[A-Z]/.test(w);
const endsSentence = (w: string): boolean => /[.!?]$/.test(w);

interface Candidate {
  phrase: string;
  startSec: number;
  sentenceStart: boolean;
  wordCount: number;
}

/**
 * Find capitalized phrases in the transcript — likely proper nouns.
 * Connectors ("of", "the") are allowed inside a phrase so "Gulf of Mexico"
 * survives as one candidate.
 */
export const findCandidatePhrases = (words: Word[]): Candidate[] => {
  const out: Candidate[] = [];
  const connectors = new Set(["of", "the", "de", "da", "del", "la", "el"]);
  let i = 0;
  let sentenceStart = true;

  while (i < words.length) {
    const raw = words[i].text;
    const w = cleanWord(raw);
    if (w && isCapitalized(w) && !STOPWORDS.has(w.toLowerCase())) {
      const parts = [w];
      const startSec = words[i].startSec;
      const startedSentence = sentenceStart;
      let j = i + 1;
      let ended = endsSentence(raw);
      while (j < words.length && !ended) {
        const nraw = words[j].text;
        const nw = cleanWord(nraw);
        if (!nw) break;
        if (isCapitalized(nw)) {
          parts.push(nw);
        } else if (
          connectors.has(nw.toLowerCase()) &&
          j + 1 < words.length &&
          isCapitalized(cleanWord(words[j + 1].text))
        ) {
          parts.push(nw.toLowerCase());
        } else {
          break;
        }
        ended = endsSentence(nraw);
        j++;
      }
      out.push({
        phrase: parts.join(" "),
        startSec,
        sentenceStart: startedSentence,
        wordCount: parts.length,
      });
      sentenceStart = endsSentence(words[j - 1]?.text ?? "");
      i = j;
    } else {
      sentenceStart = endsSentence(raw);
      i++;
    }
  }
  return out;
};

interface NominatimResult {
  display_name: string;
  importance?: number;
  boundingbox: [string, string, string, string]; // minLat, maxLat, minLon, maxLon
  geojson?: {
    type: string;
    coordinates: unknown;
  };
  addresstype?: string;
  class?: string;
  address?: { country_code?: string };
}

/** Ramer–Douglas–Peucker line simplification. */
const simplifyRing = (ring: Ring, tolerance: number): Ring => {
  if (ring.length <= 4) return ring;
  const sqTol = tolerance * tolerance;
  const sqSegDist = (p: [number, number], a: [number, number], b: [number, number]) => {
    let x = a[0];
    let y = a[1];
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = b[0];
        y = b[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Array(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let k = first + 1; k < last; k++) {
      const d = sqSegDist(ring[k], ring[first], ring[last]);
      if (d > maxDist) {
        maxDist = d;
        index = k;
      }
    }
    if (maxDist > sqTol && index !== -1) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return ring.filter((_, k) => keep[k]);
};

/** Simplify a ring until it has at most maxPoints vertices. */
const capRing = (ring: Ring, bboxDiag: number, maxPoints = 400): Ring => {
  let tol = bboxDiag / 800;
  let out = ring;
  for (let pass = 0; pass < 8 && out.length > maxPoints; pass++) {
    out = simplifyRing(ring, tol);
    tol *= 2;
  }
  return out;
};

const extractRings = (
  geojson: NominatimResult["geojson"],
  bboxDiag: number
): Ring[] => {
  if (!geojson) return [];
  let polys: Ring[][] = [];
  if (geojson.type === "Polygon") {
    polys = [geojson.coordinates as Ring[]];
  } else if (geojson.type === "MultiPolygon") {
    polys = geojson.coordinates as Ring[][];
  } else {
    return [];
  }
  // Outer ring of each polygon part, largest parts first, capped at 10 parts.
  const outers = polys
    .map((rings) => rings[0])
    .filter((r) => r && r.length >= 4)
    .sort((a, b) => b.length - a.length)
    .slice(0, 10);
  return outers.map((r) => capRing(r as Ring, bboxDiag));
};

/** Circular fallback polygon for point-only geocode results (small towns etc). */
const circleRing = (lon: number, lat: number, radiusKm: number): Ring => {
  const ring: Ring = [];
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  for (let a = 0; a <= 360; a += 12) {
    const rad = (a * Math.PI) / 180;
    ring.push([lon + Math.cos(rad) * dLon, lat + Math.sin(rad) * dLat]);
  }
  return ring;
};

const ACCEPTED_TYPES = new Set([
  "country", "state", "region", "province", "county", "city", "town",
  "island", "archipelago", "sea", "ocean", "bay", "gulf", "peninsula",
  "desert", "mountain_range", "river", "lake", "continent", "territory",
  "state_district", "municipality", "village",
]);

/**
 * Geocode candidate phrases against OpenStreetMap Nominatim (free, 1 req/s).
 * Returns places in spoken order, deduplicated.
 */
export const extractPlaces = async (
  words: Word[],
  overridePlaces?: string[]
): Promise<PlaceHit[]> => {
  let candidates: Candidate[];
  if (overridePlaces && overridePlaces.length > 0) {
    // Pin overrides to their first mention in the VO, or spread evenly.
    const lastEnd = words.length ? words[words.length - 1].endSec : 60;
    candidates = overridePlaces.map((p, i) => {
      const mention = words.find((w) =>
        p.toLowerCase().startsWith(cleanWord(w.text).toLowerCase()) &&
        cleanWord(w.text).length > 2
      );
      return {
        phrase: p,
        startSec: mention ? mention.startSec : (i * lastEnd) / overridePlaces.length,
        sentenceStart: false,
        wordCount: p.split(/\s+/).length,
      };
    });
  } else {
    candidates = findCandidatePhrases(words);
  }

  const seen = new Set<string>();
  const places: PlaceHit[] = [];

  for (const cand of candidates) {
    const key = cand.phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: cand.phrase,
        format: "jsonv2",
        limit: "1",
        polygon_geojson: "1",
        polygon_threshold: "0.002",
        addressdetails: "1",
      }).toString();

    let results: NominatimResult[];
    try {
      results = await fetchJson<NominatimResult[]>(url);
    } catch (err) {
      console.warn(`  geocode failed for "${cand.phrase}": ${err}`);
      await sleep(1100);
      continue;
    }
    await sleep(1100); // Nominatim usage policy: max 1 request/second

    const r = results[0];
    if (!r) continue;
    const type = r.addresstype ?? "";
    const importance = r.importance ?? 0;
    if (!ACCEPTED_TYPES.has(type)) continue;
    // Single capitalized words at sentence starts are often not places
    // ("Turkey travels...") — demand a strong geocode match for those.
    if (cand.sentenceStart && cand.wordCount === 1 && importance < 0.55) continue;

    const [minLat, maxLat, minLon, maxLon] = r.boundingbox.map(Number);
    const bbox: [number, number, number, number] = [minLon, minLat, maxLon, maxLat];
    const diag = Math.hypot(maxLon - minLon, maxLat - minLat);
    let rings = extractRings(r.geojson, diag);
    if (rings.length === 0) {
      rings = [circleRing((minLon + maxLon) / 2, (minLat + maxLat) / 2, 10)];
    }

    console.log(`  place: ${cand.phrase} (${type}, importance ${importance.toFixed(2)})`);
    places.push({
      name: cand.phrase,
      displayName: r.display_name,
      mentionSec: cand.startSec,
      bbox,
      rings,
      countryCode:
        type === "country" ? r.address?.country_code?.toLowerCase() : undefined,
    });
  }

  return places.sort((a, b) => a.mentionSec - b.mentionSec);
};

/**
 * Pick keywords worth illustrating with a photo: capitalized non-place
 * entities first, then distinctive long words — spaced apart in time.
 */
export const pickPhotoKeywords = (
  words: Word[],
  places: PlaceHit[],
  maxCount: number,
  minGapSec = 5
): PhotoKeyword[] => {
  const placeWords = new Set(
    places.flatMap((p) => p.name.toLowerCase().split(/\s+/))
  );
  const picked: PhotoKeyword[] = [];
  const usedKeywords = new Set<string>();

  const tryAdd = (keyword: string, startSec: number): void => {
    const key = keyword.toLowerCase();
    if (usedKeywords.has(key)) return;
    if (picked.some((p) => Math.abs(p.startSec - startSec) < minGapSec)) return;
    usedKeywords.add(key);
    picked.push({ keyword, startSec });
  };

  // Pass 1: capitalized phrases that were not geocoded as places
  for (const cand of findCandidatePhrases(words)) {
    if (picked.length >= maxCount) break;
    const parts = cand.phrase.toLowerCase().split(/\s+/);
    if (parts.some((p) => placeWords.has(p))) continue;
    if (cand.sentenceStart && cand.wordCount === 1) continue;
    tryAdd(cand.phrase, cand.startSec);
  }

  // Pass 2: distinctive long words
  for (const w of words) {
    if (picked.length >= maxCount) break;
    const clean = cleanWord(w.text).toLowerCase();
    if (clean.length < 7 || STOPWORDS.has(clean) || placeWords.has(clean)) continue;
    tryAdd(clean, w.startSec);
  }

  return picked.sort((a, b) => a.startSec - b.startSec).slice(0, maxCount);
};
