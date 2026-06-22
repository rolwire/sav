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
