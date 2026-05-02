import type { InsertTimelineSegment } from "@workspace/db";

const SECTION_PATTERN = [
  "intro",
  "verse",
  "pre_chorus",
  "chorus",
  "verse",
  "pre_chorus",
  "chorus",
  "bridge",
  "drop",
  "chorus",
  "outro",
] as const;

const EMOTIONS = [
  "anticipation",
  "tension",
  "rising hope",
  "ecstatic release",
  "wistful",
  "yearning",
  "triumphant",
  "hypnotic",
  "explosive",
  "transcendent",
  "fading echo",
];

const INTENSITIES = [0.25, 0.4, 0.6, 0.92, 0.45, 0.65, 0.95, 0.55, 1.0, 0.9, 0.35];

function pseudoRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMockAnalysis(projectId: string, durationSec: number, bpmHint?: number) {
  const rng = pseudoRandom(projectId);
  const bpm = bpmHint ?? Math.round(82 + rng() * 64);
  const keys = ["A min", "C min", "F# min", "D min", "G min", "B min", "E min"];
  const keySignature = keys[Math.floor(rng() * keys.length)] ?? "A min";
  const energy = 0.55 + rng() * 0.4;
  const loudnessDb = -(6 + rng() * 8);

  const totalSegments = SECTION_PATTERN.length;
  const segLen = durationSec / totalSegments;

  const segments: Omit<InsertTimelineSegment, "id">[] = SECTION_PATTERN.map((section, i) => ({
    projectId,
    index: i,
    startSec: +(i * segLen).toFixed(2),
    endSec: +((i + 1) * segLen).toFixed(2),
    section,
    intensity: INTENSITIES[i] ?? 0.5,
    emotion: EMOTIONS[i] ?? "drive",
    bpm,
  }));

  const emotionalMap: { timeSec: number; valence: number; arousal: number; label: string }[] = [];
  const points = 32;
  for (let i = 0; i <= points; i++) {
    const t = (durationSec * i) / points;
    const phase = (i / points) * Math.PI * 2;
    const valence = 0.5 + Math.sin(phase * 1.3 + rng()) * 0.4;
    const arousal = 0.5 + Math.sin(phase * 2.1 + rng()) * 0.45;
    const label =
      arousal > 0.75 ? "peak" : arousal > 0.5 ? "build" : arousal > 0.3 ? "groove" : "rest";
    emotionalMap.push({
      timeSec: +t.toFixed(2),
      valence: +Math.max(0, Math.min(1, valence)).toFixed(3),
      arousal: +Math.max(0, Math.min(1, arousal)).toFixed(3),
      label,
    });
  }

  return { bpm, keySignature, energy, loudnessDb, segments, emotionalMap };
}

export function buildPromptText(scene: {
  title: string;
  description: string;
  shotType: string;
  cameraMovement: string;
  location: string;
  lighting: string;
  colorPalette: string;
  wardrobe: string | null;
  aiPrompt?: string | null;
}) {
  if (scene.aiPrompt && scene.aiPrompt.trim().length > 0) return scene.aiPrompt;
  const parts = [
    `${scene.shotType}, ${scene.cameraMovement}`,
    scene.location,
    `lighting: ${scene.lighting}`,
    `palette: ${scene.colorPalette}`,
    scene.wardrobe ? `wardrobe: ${scene.wardrobe}` : null,
    "cinematic, 35mm film grain, anamorphic lens flare, music video aesthetic, Shotgun Ninjas direction",
    scene.description,
  ].filter(Boolean);
  return parts.join(". ");
}
