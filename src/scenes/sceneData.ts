export type CameraMove =
  | "descend"
  | "forward"
  | "dolly"
  | "glide"
  | "push-in"
  | "orbit"
  | "slide"
  | "macro-rotate"
  | "top-down"
  | "crane-down"
  | "pull-back"
  | "upward";

export interface SceneData {
  id: number;
  title: string;
  subtitle: string;
  prompt: string;
  durationFrames: number;
  cameraMove: CameraMove;
  /** CSS gradient for placeholder background */
  bg: string;
  /** Accent colour for UI chrome */
  accent: string;
}

// 30 fps throughout
const FPS = 30;
const s = (sec: number) => sec * FPS;

export const SCENES: SceneData[] = [
  // ── Scenes 1–6: 8 seconds each ──────────────────────────────────────────
  {
    id: 1,
    title: "The Wilderness Tabernacle",
    subtitle: "Broad View",
    prompt:
      "Ancient Israelite camp in the wilderness at sunrise, thousands of tents surrounding the Tabernacle at the center, pillar of divine light above the sanctuary, desert mountains in distance, cinematic aerial drone shot, slow descending camera movement, golden morning light, dust particles glowing in sunlight, ultra realistic biblical documentary style, ARRI Alexa 65, 16:9.",
    durationFrames: s(8),
    cameraMove: "descend",
    bg: "radial-gradient(ellipse at 50% 20%, #f5c842 0%, #c87941 30%, #7a3a1a 60%, #1a0d00 100%)",
    accent: "#f5c842",
  },
  {
    id: 2,
    title: "Approaching the Tabernacle",
    subtitle: "Outer View",
    prompt:
      "Camera slowly flies toward the Tabernacle courtyard entrance, Levites standing guard, white linen curtains moving in desert wind, worshippers visible in distance, cinematic forward tracking shot, realistic ancient Israel, 16:9.",
    durationFrames: s(8),
    cameraMove: "forward",
    bg: "linear-gradient(160deg, #e8c87a 0%, #b87a3a 40%, #5c2e10 80%, #0d0800 100%)",
    accent: "#e8c87a",
  },
  {
    id: 3,
    title: "Entering the Courtyard",
    subtitle: "The Bronze Altar",
    prompt:
      "Massive bronze altar burning with sacrifice, priests in white garments moving around the altar, smoke rising toward the sky, slow cinematic dolly shot forward, warm firelight and sunlight mixing, historical accuracy, 16:9.",
    durationFrames: s(8),
    cameraMove: "dolly",
    bg: "radial-gradient(ellipse at 40% 60%, #ff8c00 0%, #c44a00 35%, #5a1500 65%, #0d0400 100%)",
    accent: "#ff9a30",
  },
  {
    id: 4,
    title: "The Holy Place",
    subtitle: "Interior Sanctuary",
    prompt:
      "Interior of the Tabernacle Holy Place, golden lampstand glowing, table of showbread, altar of incense releasing smoke, rich blue purple and scarlet curtains, camera slowly gliding through the room, cinematic lighting, 16:9.",
    durationFrames: s(8),
    cameraMove: "glide",
    bg: "linear-gradient(135deg, #2a0a4a 0%, #4a1a6a 25%, #8b4513 50%, #d4a017 75%, #1a0a2a 100%)",
    accent: "#d4a017",
  },
  {
    id: 5,
    title: "The Veil",
    subtitle: "Threshold of the Most Holy Place",
    prompt:
      "Gigantic embroidered veil separating the Holy Place from the Most Holy Place, golden cherubim woven into the fabric, camera slowly pushing toward the curtain, suspenseful sacred atmosphere, 16:9.",
    durationFrames: s(8),
    cameraMove: "push-in",
    bg: "linear-gradient(180deg, #0a0020 0%, #1a0040 30%, #4a1560 55%, #8b4513 80%, #2a0060 100%)",
    accent: "#c8a0ff",
  },
  {
    id: 6,
    title: "Entering the Most Holy Place",
    subtitle: "The Sacred Reveal",
    prompt:
      "The veil parts slowly, revealing darkness illuminated by rays of heavenly light, sacred silence, camera enters cautiously into the Most Holy Place, cinematic reveal, 16:9.",
    durationFrames: s(8),
    cameraMove: "forward",
    bg: "radial-gradient(ellipse at 50% 50%, #ffffcc 0%, #ffd700 15%, #8b6914 45%, #1a0d00 80%, #000000 100%)",
    accent: "#fff9a0",
  },

  // ── Scenes 7–14: 6 seconds each ─────────────────────────────────────────
  {
    id: 7,
    title: "First Full View of the Ark",
    subtitle: "The Ark of the Covenant",
    prompt:
      "Ark of the Covenant standing alone in the center of the Most Holy Place, pure gold surfaces reflecting divine light, dramatic god rays from above, slow orbit camera movement around the Ark, ultra realistic biblical documentary style, 16:9.",
    durationFrames: s(6),
    cameraMove: "orbit",
    bg: "radial-gradient(ellipse at 50% 30%, #ffd700 0%, #b8860b 30%, #3d2600 65%, #0d0700 100%)",
    accent: "#ffd700",
  },
  {
    id: 8,
    title: "Front View of the Ark",
    subtitle: "Hero Shot",
    prompt:
      "Straight-on cinematic hero shot of the Ark of the Covenant, detailed gold craftsmanship, sacred atmosphere, soft glowing reflections, slow push-in camera movement, museum-level detail, 16:9.",
    durationFrames: s(6),
    cameraMove: "push-in",
    bg: "linear-gradient(180deg, #0d0700 0%, #2a1800 30%, #8b6900 60%, #ffd700 85%, #3d2600 100%)",
    accent: "#ffd700",
  },
  {
    id: 9,
    title: "Side View of the Ark",
    subtitle: "Gold-Covered Acacia Wood",
    prompt:
      "Detailed side profile of the Ark showing gold-covered acacia wood construction, intricate carvings, realistic textures, camera sliding sideways, cinematic macro detail, 16:9.",
    durationFrames: s(6),
    cameraMove: "slide",
    bg: "linear-gradient(90deg, #0a0500 0%, #3d2600 30%, #b8860b 60%, #ffd700 80%, #3d2600 100%)",
    accent: "#daa520",
  },
  {
    id: 10,
    title: "The Carrying Poles",
    subtitle: "Acacia Overlaid with Gold",
    prompt:
      "Close-up of the golden carrying poles passing through the rings of the Ark, polished gold surfaces, shallow depth of field, slow tracking shot, dramatic lighting, 16:9.",
    durationFrames: s(6),
    cameraMove: "slide",
    bg: "radial-gradient(ellipse at 30% 50%, #ffd700 0%, #b8860b 25%, #5c3a00 55%, #0d0700 100%)",
    accent: "#ffd700",
  },
  {
    id: 11,
    title: "Gold Rings Detail",
    subtitle: "Fine Craftsmanship",
    prompt:
      "Extreme close-up of one golden ring attached to the Ark, fine craftsmanship visible, reflections dancing across the metal, slow cinematic macro rotation, 16:9.",
    durationFrames: s(6),
    cameraMove: "macro-rotate",
    bg: "radial-gradient(circle at 50% 50%, #ffe066 0%, #ffd700 20%, #b8860b 50%, #3d2600 80%, #0d0700 100%)",
    accent: "#ffe066",
  },
  {
    id: 12,
    title: "The Mercy Seat",
    subtitle: "Top View — Pure Gold Cover",
    prompt:
      "Top-down view of the Mercy Seat, pure gold cover of the Ark, divine light illuminating the surface, camera slowly descending toward the center, sacred atmosphere, 16:9.",
    durationFrames: s(6),
    cameraMove: "top-down",
    bg: "radial-gradient(ellipse at 50% 0%, #fff9cc 0%, #ffd700 25%, #b8860b 55%, #1a0d00 100%)",
    accent: "#fff9cc",
  },
  {
    id: 13,
    title: "The Cherubim",
    subtitle: "Wings Outstretched Over the Mercy Seat",
    prompt:
      "Two golden cherubim facing each other with wings stretched over the Mercy Seat, intricate feather detail, heavenly light shining between them, slow orbit shot, cinematic realism, 16:9.",
    durationFrames: s(6),
    cameraMove: "orbit",
    bg: "radial-gradient(ellipse at 50% 40%, #fff5aa 0%, #ffd700 20%, #8b6914 45%, #0d0700 80%, #000000 100%)",
    accent: "#fff5aa",
  },
  {
    id: 14,
    title: "Presence Between the Cherubim",
    subtitle: "The Shekinah Glory",
    prompt:
      "Bright divine glory appearing between the wings of the cherubim, supernatural light filling the room, gold reflecting intensely, slow upward camera movement, biblical documentary style, 16:9.",
    durationFrames: s(6),
    cameraMove: "upward",
    bg: "radial-gradient(ellipse at 50% 50%, #ffffff 0%, #ffffaa 10%, #ffd700 30%, #ff8c00 55%, #1a0700 85%, #000000 100%)",
    accent: "#ffffff",
  },

  // ── Scenes 15–19: 7 seconds each ────────────────────────────────────────
  {
    id: 15,
    title: "Opening the Ark",
    subtitle: "The Mercy Seat Lifted",
    prompt:
      "The Mercy Seat slowly lifting from the Ark, dramatic sacred reveal, golden dust particles floating through beams of light, slow cinematic crane movement downward, 16:9.",
    durationFrames: s(7),
    cameraMove: "crane-down",
    bg: "radial-gradient(ellipse at 50% 20%, #fffacc 0%, #ffd700 20%, #b8860b 45%, #3d2600 70%, #0d0700 100%)",
    accent: "#fffacc",
  },
  {
    id: 16,
    title: "Inside the Ark — Overview",
    subtitle: "Three Sacred Items",
    prompt:
      "Interior view of the Ark of the Covenant, three sacred items resting inside, warm heavenly illumination, camera slowly moving above the contents, cinematic documentary visualization, 16:9.",
    durationFrames: s(7),
    cameraMove: "top-down",
    bg: "radial-gradient(ellipse at 50% 30%, #fff0a0 0%, #daa520 30%, #5c3a00 60%, #0d0700 100%)",
    accent: "#fff0a0",
  },
  {
    id: 17,
    title: "The Stone Tablets",
    subtitle: "Ten Commandments — Exodus 25:16",
    prompt:
      "Two stone tablets of the Ten Commandments resting inside the Ark, ancient Hebrew inscriptions carved into stone, dramatic close-up, cinematic push-in shot, golden divine light, 16:9.",
    durationFrames: s(7),
    cameraMove: "push-in",
    bg: "linear-gradient(160deg, #1a1a2e 0%, #3a3060 30%, #8b7355 60%, #c8aa82 80%, #2a2030 100%)",
    accent: "#c8aa82",
  },
  {
    id: 18,
    title: "Aaron's Rod That Budded",
    subtitle: "Numbers 17:8–10",
    prompt:
      "Aaron's rod that budded lying inside the Ark, almond blossoms visible on the staff, miraculous symbol of priesthood, slow macro camera movement along the rod, cinematic detail, 16:9.",
    durationFrames: s(7),
    cameraMove: "slide",
    bg: "linear-gradient(120deg, #0d1a00 0%, #1a3a00 30%, #4a7a00 55%, #c8aa82 80%, #0d1a00 100%)",
    accent: "#a8d060",
  },
  {
    id: 19,
    title: "The Golden Pot of Manna",
    subtitle: "Exodus 16:33–34",
    prompt:
      "Golden jar filled with manna, detailed close-up of heavenly bread inside the vessel, rich gold textures, cinematic rotating camera shot, divine illumination, 16:9.",
    durationFrames: s(7),
    cameraMove: "macro-rotate",
    bg: "radial-gradient(ellipse at 50% 50%, #fff9e0 0%, #ffd700 20%, #b8860b 50%, #3d2600 80%, #0d0700 100%)",
    accent: "#fff9e0",
  },

  // ── Scene 20: 12 seconds ─────────────────────────────────────────────────
  {
    id: 20,
    title: "Final Glory Reveal",
    subtitle: "God's Presence & Glory",
    prompt:
      "The Ark of the Covenant closed once again, brilliant divine presence above the Mercy Seat, beams of heavenly light filling the Most Holy Place, camera slowly pulling back through the veil, through the Tabernacle, rising high above the Israelite camp, epic ending shot, biblical documentary masterpiece, ARRI Alexa 65, volumetric lighting, cinematic realism, 16:9.",
    durationFrames: s(12),
    cameraMove: "pull-back",
    bg: "radial-gradient(ellipse at 50% 40%, #ffffff 0%, #fff9aa 8%, #ffd700 22%, #c87941 45%, #3d1a00 70%, #0d0500 100%)",
    accent: "#ffffff",
  },
];

export const TOTAL_FRAMES = SCENES.reduce((sum, s) => sum + s.durationFrames, 0);
export const FPS_EXPORT = FPS;
