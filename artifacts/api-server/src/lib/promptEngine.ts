import type { StoryboardScene } from "@workspace/db";
import { VISUAL_STYLES, type VisualStyleId } from "./sceneGenerator";

export interface PromptBlock {
  subject: string;
  setting: string;
  visualStyle: string;
  cameraMotion: string;
  lighting: string;
  mood: string;
  colorPalette: string;
  aspectRatio: string;
  negativePrompt: string;
  durationSec: number;
  transition: string;
}

export type PlatformId =
  | "runway"
  | "pika"
  | "kling"
  | "luma"
  | "pixverse"
  | "stable_diffusion"
  | "midjourney"
  | "leonardo"
  | "capcut"
  | "davinci";

export type PlatformKind = "video" | "image" | "editing";

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  kind: PlatformKind;
  description: string;
}

export const PLATFORMS: PlatformMeta[] = [
  {
    id: "runway",
    label: "Runway Gen-3",
    kind: "video",
    description: "Cinematic AI video. Structured natural language.",
  },
  {
    id: "pika",
    label: "Pika 1.5",
    kind: "video",
    description: "Fast motion clips. Concise sentence-style prompts.",
  },
  {
    id: "kling",
    label: "Kling 1.6",
    kind: "video",
    description: "Detailed multi-field prompt with explicit negative.",
  },
  {
    id: "luma",
    label: "Luma Dream Machine",
    kind: "video",
    description: "Action-led natural language, motion-first phrasing.",
  },
  {
    id: "pixverse",
    label: "PixVerse V3",
    kind: "video",
    description: "Tagged style + camera + duration descriptors.",
  },
  {
    id: "stable_diffusion",
    label: "Stable Diffusion",
    kind: "image",
    description: "Tag-soup with weights, modifiers, and negative.",
  },
  {
    id: "midjourney",
    label: "Midjourney v6",
    kind: "image",
    description: "/imagine prompt with --ar / --no flags.",
  },
  {
    id: "leonardo",
    label: "Leonardo.Ai",
    kind: "image",
    description: "Cinematic photograph prompt with lens detail.",
  },
  {
    id: "capcut",
    label: "CapCut Notes",
    kind: "editing",
    description: "Mobile editing instructions: cuts, speed, filters.",
  },
  {
    id: "davinci",
    label: "DaVinci Resolve Notes",
    kind: "editing",
    description: "Professional NLE notes: color, power windows, audio.",
  },
];

const NEGATIVE_BASE =
  "low quality, watermark, text, blurry, deformed, mutated, extra limbs, oversaturated, low contrast, washed out, jpeg artifacts, cartoon";

function transitionFor(motionIntensity: string): string {
  switch (motionIntensity) {
    case "still":
      return "Hard cut on beat — hold last frame";
    case "low":
      return "Smooth 8-frame dissolve";
    case "medium":
      return "Match cut on action";
    case "high":
      return "Whip pan into next scene";
    case "explosive":
      return "Glitch / impact-frame transition";
    default:
      return "Match cut on action";
  }
}

function firstSentence(text: string, maxLen = 140): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const s = (sentences[0] ?? text).trim();
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

export interface PromptEngineInput {
  scene: StoryboardScene;
  project: {
    title: string;
    artist?: string | null;
    genre?: string | null;
    mood?: string | null;
    visualStyle?: string | null;
    visualDirection?: string | null;
    brandDirection?: string | null;
  };
  defaultAspectRatio: string;
  defaultDurationSec: number;
}

export function buildPromptBlock(input: PromptEngineInput): PromptBlock {
  const { scene, project, defaultAspectRatio, defaultDurationSec } = input;

  const styleId = (project.visualStyle as VisualStyleId | undefined) ?? "custom";
  const preset = VISUAL_STYLES[styleId] ?? VISUAL_STYLES.custom;
  const styleLabel = preset?.label ?? "Custom direction";

  // Use `||` so empty-string fields (which the schema allows) fall through to
  // the next candidate. `??` would only fall through on null/undefined.
  const subject =
    scene.characterAction?.trim() ||
    firstSentence(scene.description || scene.title || "Performer in frame");

  const setting = scene.environment?.trim() || scene.location || "an evocative location";

  // If a scene has degenerate timing (end <= start), fall back to the
  // settings-provided default duration before clamping into the platform-safe
  // 2..10s window most generators accept.
  const rawDuration = scene.endSec - scene.startSec;
  const sceneDuration = rawDuration > 0 ? rawDuration : Math.max(1, defaultDurationSec);
  const durationSuggested = Math.min(10, Math.max(2, Math.round(sceneDuration)));

  const moodParts = [scene.emotionalPurpose?.trim(), project.mood?.trim()].filter(Boolean);
  const mood = moodParts.length > 0 ? moodParts.join(" / ") : "cinematic, kinetic";

  const visualStyleParts = [styleLabel, project.brandDirection?.trim()].filter(Boolean);
  const visualStyle = visualStyleParts.join(" — ");

  return {
    subject,
    setting,
    visualStyle,
    cameraMotion: scene.cameraMovement,
    lighting: scene.lighting,
    mood,
    colorPalette: scene.colorPalette,
    aspectRatio: defaultAspectRatio || "16:9",
    negativePrompt: NEGATIVE_BASE,
    durationSec: durationSuggested,
    transition: transitionFor(scene.motionIntensity || "medium"),
  };
}

function dur(b: PromptBlock) {
  return `${b.durationSec}s`;
}

export function formatForPlatform(
  platform: PlatformId,
  block: PromptBlock,
  scene: StoryboardScene,
): string {
  switch (platform) {
    case "runway":
      return [
        `${scene.shotType} of ${block.subject}.`,
        `Setting: ${block.setting}.`,
        `Camera: ${block.cameraMotion}.`,
        `Lighting: ${block.lighting}.`,
        `Color palette: ${block.colorPalette}.`,
        `Style: ${block.visualStyle}.`,
        `Mood: ${block.mood}.`,
        `Aspect ${block.aspectRatio}, ${dur(block)}.`,
      ].join(" ");

    case "pika":
      return `${block.subject} in ${block.setting}, ${block.cameraMotion}, ${block.lighting}, ${block.mood}. ${block.visualStyle}. -ar ${block.aspectRatio} -motion 3 -fps 24`;

    case "kling":
      return [
        `[${scene.shotType}] ${block.subject}`,
        `Environment: ${block.setting}`,
        `Camera move: ${block.cameraMotion}`,
        `Lighting: ${block.lighting}`,
        `Palette: ${block.colorPalette}`,
        `Visual style: ${block.visualStyle}`,
        `Mood: ${block.mood}`,
        `Aspect ratio: ${block.aspectRatio}`,
        `Duration: ${dur(block)}`,
        `Negative: ${block.negativePrompt}`,
      ].join(" | ");

    case "luma":
      return `${block.subject} — set in ${block.setting}. ${block.cameraMotion}. ${block.lighting}, ${block.colorPalette}. ${block.mood}. ${block.visualStyle}. (${dur(block)}, ${block.aspectRatio})`;

    case "pixverse":
      return [
        block.subject,
        block.setting,
        `style: ${block.visualStyle}`,
        `camera: ${block.cameraMotion}`,
        `light: ${block.lighting}`,
        `palette: ${block.colorPalette}`,
        `mood: ${block.mood}`,
        `duration: ${dur(block)}`,
        `aspect: ${block.aspectRatio}`,
      ].join(", ");

    case "stable_diffusion":
      return `(masterpiece:1.2), (best quality:1.1), ${block.subject}, ${block.setting}, ${block.visualStyle}, ${block.cameraMotion}, ${block.lighting}, ${block.colorPalette}, cinematic, 35mm, sharp focus --ar ${block.aspectRatio} --no ${block.negativePrompt}`;

    case "midjourney":
      return `/imagine prompt: ${block.subject} in ${block.setting}, ${block.visualStyle}, ${block.cameraMotion}, ${block.lighting}, ${block.colorPalette}, ${block.mood}, cinematic still --ar ${block.aspectRatio} --style raw --v 6 --no ${block.negativePrompt}`;

    case "leonardo":
      return `Cinematic photograph of ${block.subject} in ${block.setting}. ${block.lighting}. ${block.colorPalette}. Shot on Arri Alexa, 35mm anamorphic lens, ${block.cameraMotion}. ${block.visualStyle}. ${block.mood}. Aspect ${block.aspectRatio}. Negative: ${block.negativePrompt}`;

    case "capcut":
      return [
        `Scene ${scene.index + 1} (${scene.startSec.toFixed(1)}s–${scene.endSec.toFixed(1)}s)`,
        `Clip in: ${block.transition}`,
        `Speed: ${scene.motionIntensity}`,
        `Filter: match palette ${block.colorPalette}`,
        `Adjust: contrast +12, saturation +6, shadows -8`,
        `Audio sync: place beat marker at start, cut on next downbeat`,
        `Caption style: bold sans, drop shadow, ${block.mood}`,
      ].join(" • ");

    case "davinci":
      return [
        `Clip ${scene.index + 1} @ ${scene.startSec.toFixed(2)}s (${dur(block)})`,
        `Edit: ${block.transition}`,
        `Color: build node tree — base balance, contrast curve, palette grade toward ${block.colorPalette}`,
        `Power Window: track primary subject (${block.subject.split(/[,.]/)[0]?.trim() || "subject"})`,
        `LUT suggestion: cinematic teal/orange hybrid keyed to ${block.lighting}`,
        `Fairlight: duck music -3dB on dialog if present, sync cut to beat at ${scene.startSec.toFixed(2)}s`,
        `Deliver: ${block.aspectRatio}, 24fps, ProRes 422 HQ`,
      ].join(" | ");

    default:
      return "";
  }
}

export interface ScenePromptEngineRow {
  sceneId: string;
  sceneIndex: number;
  sceneTitle: string;
  startSec: number;
  endSec: number;
  shotType: string;
  cameraMovement: string;
  block: PromptBlock;
  platforms: Record<PlatformId, string>;
}

export function buildScenePromptEngineRow(input: PromptEngineInput): ScenePromptEngineRow {
  const block = buildPromptBlock(input);
  const platforms = {} as Record<PlatformId, string>;
  for (const p of PLATFORMS) {
    platforms[p.id] = formatForPlatform(p.id, block, input.scene);
  }
  return {
    sceneId: input.scene.id,
    sceneIndex: input.scene.index,
    sceneTitle: input.scene.title,
    startSec: input.scene.startSec,
    endSec: input.scene.endSec,
    shotType: input.scene.shotType,
    cameraMovement: input.scene.cameraMovement,
    block,
    platforms,
  };
}
