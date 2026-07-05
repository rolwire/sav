# sav — Remotion Video Projects

Two compositions live in this repo:

1. **Map Reel** — automated GeoBites-style map-animation reels (VO in → video out)
2. **Ark of the Covenant** — 20-scene cinematic sequence

---

# Map Reel — automated map-animation pipeline

Drop in a voiceover; get back a vertical (1080×1920) reel where a satellite
map flies between every place you mention, highlights it GeoBites-style
(glowing border draw-on + cyan hatch fill), pops up real photos from public
libraries when keywords are spoken, and shows word-synced captions.

## One command

```bash
npm run reel -- --vo path/to/voiceover.mp3
npm run reel:render          # renders out/mapreel.mp4
```

Works in **9:16** (default), **16:9**, or both:

```bash
npm run reel -- --vo vo.mp3 --aspect 16:9    # landscape only
npm run reel -- --vo vo.mp3 --aspect both    # both formats in one run
npm run reel:render          # 9:16  -> out/mapreel.mp4      (MapReel)
npm run reel:render:wide     # 16:9  -> out/mapreel-wide.mp4 (MapReelWide)
```

## What the pipeline does

| Step | Tool | Notes |
|---|---|---|
| 1. Transcribe | whisper.cpp (auto-installed to `.whisper/`) | word-level timestamps |
| 2. Detect places | OpenStreetMap Nominatim (free) | real border polygons, spoken order |
| 3. Satellite tiles | Esri World Imagery (free) | only the tiles the camera will see |
| 4. Keyword photos | Wikimedia Commons → Openverse fallback | openly licensed, attribution kept |
| 5. Build timeline | `src/mapreel/timeline.json` | drives the Remotion `MapReel` comp |

## Options

```bash
--transcript t.json   # skip whisper (Word[] JSON or whisper.cpp JSON)
--places "Egypt,Nile" # skip place detection, use these in this order
--model medium.en     # whisper model (default base.en)
--max-photos 8        # cap keyword photos
--no-photos           # maps only
--aspect both         # 9:16 (default), 16:9, or both
```

## Offline demo (no VO, no network)

```bash
npm run reel:demo     # procedurally generated islands + placeholder photos
npm start             # preview the MapReel composition in Remotion Studio
npm run reel:render
```

## Attribution

The end card credits Esri World Imagery, OpenStreetMap contributors, and each
photo's author/license automatically. Keep it in published videos — it is the
condition of the free imagery/photo sources.

---

# Ark of the Covenant — Cinematic Sequence

A 20-scene Remotion video project for the **Ark of the Covenant** documentary reveal.

## Project at a Glance

| | |
|---|---|
| Scenes | 20 |
| FPS | 30 |
| Resolution | 1920 × 1080 (16:9) |
| Total runtime | ~2 min 23 s (4 350 frames incl. title card) |
| Codec | H.264 / CRF 18 |

### Scene Timing

| Scenes | Duration |
|---|---|
| 1–6 | 8 s each |
| 7–14 | 6 s each |
| 15–19 | 7 s each |
| 20 | 12 s |

---

## Getting Started

```bash
npm install
npm start          # opens Remotion Studio at localhost:3000
npm run render     # renders full video to out/ark-covenant.mp4
```

## Swapping in AI-Generated Images

1. Generate images from the prompts in `src/scenes/sceneData.ts` (or run `npx ts-node scripts/export-prompts.ts`).
2. Place images in `public/scenes/` as `scene01.jpg`, `scene02.jpg`, … `scene20.jpg`.
3. Update `IMAGE_MAP` in `src/ArkCovenant.tsx`:

```ts
const IMAGE_MAP: Record<number, string> = {
  1: staticFile("scenes/scene01.jpg"),
  2: staticFile("scenes/scene02.jpg"),
  // ...
};
```

4. Re-run `npm start` to preview, then `npm run render`.

## Project Structure

```
sav/
├── src/
│   ├── index.ts                 # Remotion entry
│   ├── Root.tsx                 # Registers compositions
│   ├── ArkCovenant.tsx          # Main composition (title + 20 scenes)
│   ├── scenes/
│   │   ├── sceneData.ts         # All scene metadata + prompts
│   │   └── CinematicScene.tsx   # Reusable scene renderer
│   └── utils/
│       └── timing.ts            # Frame-offset helpers
├── scripts/
│   └── export-prompts.ts        # Dump prompts for AI generators
├── public/
│   └── scenes/                  # Drop AI images here (scene01.jpg…)
├── remotion.config.ts
├── tsconfig.json
└── package.json
```

## Scripture Reference

> "There I will meet with you, and from above the mercy seat, from between  
> the two cherubim that are on the ark of the testimony, I will speak with you."  
> — **Exodus 25:22**
