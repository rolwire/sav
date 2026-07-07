import React from "react";
import { Composition } from "remotion";
import { ArkCovenantComposition } from "./ArkCovenant";
import { MapReel, MapReelWide, TIMELINE, TIMELINE_WIDE } from "./mapreel/MapReel";
import { SCENES, TOTAL_FRAMES, FPS_EXPORT } from "./scenes/sceneData";

const TITLE_DURATION = 60;
const FULL_DURATION = TOTAL_FRAMES + TITLE_DURATION;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="MapReel"
      component={MapReel}
      durationInFrames={TIMELINE.durationInFrames}
      fps={TIMELINE.fps}
      width={TIMELINE.width}
      height={TIMELINE.height}
      defaultProps={{}}
    />

    <Composition
      id="MapReelWide"
      component={MapReelWide}
      durationInFrames={TIMELINE_WIDE.durationInFrames}
      fps={TIMELINE_WIDE.fps}
      width={TIMELINE_WIDE.width}
      height={TIMELINE_WIDE.height}
      defaultProps={{}}
    />

    <Composition
      id="ArkCovenant"
      component={ArkCovenantComposition}
      durationInFrames={FULL_DURATION}
      fps={FPS_EXPORT}
      width={1920}
      height={1080}
      defaultProps={{}}
    />

    {/* Individual scene previews for studio inspection */}
    {SCENES.map((scene) => (
      <Composition
        key={scene.id}
        id={`Scene${String(scene.id).padStart(2, "0")}`}
        component={() => {
          const { CinematicScene } = require("./scenes/CinematicScene");
          return <CinematicScene scene={scene} />;
        }}
        durationInFrames={scene.durationFrames}
        fps={FPS_EXPORT}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    ))}
  </>
);
