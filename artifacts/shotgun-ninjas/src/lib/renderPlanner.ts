// Local Render Planner: turns a project + storyboard scenes into a step-by-step
// production walkthrough. Pure functions, no I/O — testable and reusable.
//
// Inputs come straight from the existing storyboard + project shape (no new
// API or DB schema needed). Recommendations are deterministic and explained
// in-place so the UI can show "why this tool".

import type { StoryboardScene, Project } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderToolRec {
  /** Display name, e.g. "Runway Gen-3 Alpha" */
  name: string;
  /** Why this scene fits this tool (1 short line) */
  reason: string;
  /** Free / paid posture so the user knows budget impact */
  cost: "free" | "freemium" | "paid";
  /** Web URL to open the tool */
  url: string;
}

export interface ScenePlanRow {
  index: number;
  sceneId: string;
  title: string;
  startSec: number;
  endSec: number;
  /** Recommended image tool for the keyframe (step 1 of the workflow). */
  imageTool: RenderToolRec;
  /** Recommended video tool to animate the keyframe (step 2). */
  videoTool: RenderToolRec;
  /** Prompt to paste into the chosen video tool. */
  prompt: string;
  /** Suggested clip duration: caps at the tool's max (~5s) and notes trims. */
  clipDurationSec: number;
  clipDurationNote: string;
  /** Transition into the NEXT scene (or final fade-out). */
  transitionToNext: string;
  /** Editing tempo note (cuts per beat, etc.) tuned to project BPM. */
  editingNote: string;
  /** Where in the song this scene sits (intro/verse/chorus/etc). */
  audioSyncNote: string;
}

export interface RenderPlan {
  scenes: ScenePlanRow[];
  totalRuntimeSec: number;
  workflow: WorkflowStep[];
  checklist: ChecklistGroup[];
}

export interface WorkflowStep {
  step: number;
  title: string;
  detail: string;
  toolHints: string[];
}

export interface ChecklistGroup {
  label: string;
  items: string[];
}

// ---------------------------------------------------------------------------
// Tool catalog (web pages, not affiliate links)
// ---------------------------------------------------------------------------

const IMAGE_TOOLS = {
  stableDiffusion: {
    name: "Stable Diffusion (Automatic1111 / ComfyUI)",
    reason: "Free, local, no per-image cost, total prompt control.",
    cost: "free" as const,
    url: "https://github.com/AUTOMATIC1111/stable-diffusion-webui",
  },
  midjourney: {
    name: "Midjourney v6",
    reason: "Highest cinematic image quality with minimal prompt tweaking.",
    cost: "paid" as const,
    url: "https://www.midjourney.com",
  },
  leonardo: {
    name: "Leonardo.ai",
    reason: "Free daily credits, strong cinematic models, good fast iteration.",
    cost: "freemium" as const,
    url: "https://leonardo.ai",
  },
  flux: {
    name: "Flux.1 (via Fal.ai or Replicate)",
    reason: "Best photorealism for portraits and product/tech shots.",
    cost: "freemium" as const,
    url: "https://fal.ai/models/fal-ai/flux/dev",
  },
};

const VIDEO_TOOLS = {
  runway: {
    name: "Runway Gen-3 Alpha (image-to-video)",
    reason: "Top motion fidelity for high-energy or complex camera moves.",
    cost: "paid" as const,
    url: "https://runwayml.com",
  },
  kling: {
    name: "Kling 1.6",
    reason: "Best free tier for cinematic 5-10s clips with subtle motion.",
    cost: "freemium" as const,
    url: "https://klingai.com",
  },
  luma: {
    name: "Luma Dream Machine",
    reason: "Excellent for atmospheric / dreamy shots and natural pans.",
    cost: "freemium" as const,
    url: "https://lumalabs.ai/dream-machine",
  },
  pika: {
    name: "Pika 1.5",
    reason: "Generous free tier and forgiving for short, simple shots.",
    cost: "freemium" as const,
    url: "https://pika.art",
  },
  animatediff: {
    name: "Stable Diffusion + AnimateDiff (local)",
    reason: "Free local pipeline for static / loop shots — zero cloud cost.",
    cost: "free" as const,
    url: "https://github.com/guoyww/AnimateDiff",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lower(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

function isHighMotionMovement(movement: string): boolean {
  const m = lower(movement);
  return /(dolly|crane|whip|tracking|handheld|shake|follow|jib|drone|orbit)/.test(m);
}

function isAtmospheric(movement: string): boolean {
  const m = lower(movement);
  return /(slow|push|pull|pan|drift|float|hover|static)/.test(m);
}

function isCloseUp(shotType: string): boolean {
  const s = lower(shotType);
  return /(close|extreme close|cu|portrait|insert|detail)/.test(s);
}

function songSection(startSec: number, totalSec: number): string {
  if (totalSec <= 0) return "Scene";
  const r = startSec / totalSec;
  if (r < 0.08) return "Cold open";
  if (r < 0.18) return "Intro";
  if (r < 0.4) return "Verse 1";
  if (r < 0.55) return "Chorus 1";
  if (r < 0.7) return "Verse 2 / Bridge";
  if (r < 0.85) return "Chorus 2";
  if (r < 0.96) return "Outro climax";
  return "Outro fade";
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Per-scene recommendations
// ---------------------------------------------------------------------------

function pickImageTool(scene: StoryboardScene): RenderToolRec {
  const wants = lower(scene.colorPalette ?? "");
  const isPortrait = isCloseUp(scene.shotType);
  if (isPortrait || /skin|face|portrait|product/.test(wants)) {
    return IMAGE_TOOLS.flux;
  }
  if (/(neon|cyberpunk|sci-fi|fantasy|dream)/.test(lower(scene.description))) {
    return IMAGE_TOOLS.midjourney;
  }
  if (/(minimal|clean|tech|product|brand)/.test(lower(scene.description))) {
    return IMAGE_TOOLS.leonardo;
  }
  return IMAGE_TOOLS.stableDiffusion;
}

function pickVideoTool(scene: StoryboardScene): RenderToolRec {
  const intensity = lower(scene.motionIntensity);
  const movement = scene.cameraMovement;
  const shot = scene.shotType;

  if (intensity === "explosive" || intensity === "high" || isHighMotionMovement(movement)) {
    return VIDEO_TOOLS.runway;
  }
  if (intensity === "still" || (isCloseUp(shot) && intensity === "low")) {
    return VIDEO_TOOLS.animatediff;
  }
  if (isAtmospheric(movement) && (intensity === "medium" || intensity === "low")) {
    return VIDEO_TOOLS.luma;
  }
  if (intensity === "medium") {
    return VIDEO_TOOLS.kling;
  }
  return VIDEO_TOOLS.pika;
}

function clipDuration(scene: StoryboardScene): { sec: number; note: string } {
  const length = Math.max(0, scene.endSec - scene.startSec);
  // Most AI video tools cap clips at 5s (free) or 10s (paid).
  const MAX = 5;
  if (length <= 0) {
    return { sec: 5, note: "No timeline length — generate 5s and trim in editor." };
  }
  if (length <= MAX) {
    const trim = (MAX - length).toFixed(1);
    return {
      sec: 5,
      note: `Generate 5s, trim ${trim}s in editor to land on ${length.toFixed(1)}s.`,
    };
  }
  const splits = Math.ceil(length / MAX);
  return {
    sec: 5,
    note: `Scene runs ${length.toFixed(1)}s — generate ${splits} × 5s clips and butt-cut them.`,
  };
}

function transitionToNext(
  scene: StoryboardScene,
  next: StoryboardScene | null,
): string {
  if (!next) {
    return "Final fade to black (1.0s) over the last beat. Hold black 0.5s before end card.";
  }
  const a = lower(scene.motionIntensity);
  const b = lower(next.motionIntensity);
  const sameLocation = lower(scene.location) === lower(next.location);

  if (sameLocation && (a === b || (a === "low" && b === "low"))) {
    return "Match cut on shared element (color / shape / motion direction). 0 frames overlap.";
  }
  if ((a === "high" || a === "explosive") && (b === "high" || b === "explosive")) {
    return "Hard cut on the kick. No transition — let the beat do the work.";
  }
  if ((a === "low" || a === "still") && (b === "high" || b === "explosive")) {
    return "Whip pan or 4-frame flash cut into next scene. Land the cut on the snare.";
  }
  if ((a === "high" || a === "explosive") && (b === "low" || b === "still")) {
    return "Speed ramp out (last 8 frames slow to 25%) → cross dissolve 12 frames.";
  }
  return "Cross dissolve 12 frames (≈ half a beat). Cut on the off-beat for breath.";
}

function editingNote(scene: StoryboardScene, project: Project): string {
  const bpm = project.bpm ?? 0;
  const intensity = lower(scene.motionIntensity);
  if (bpm > 0) {
    const beatSec = 60 / bpm;
    if (intensity === "explosive" || intensity === "high") {
      return `${bpm.toFixed(0)} BPM → cut every beat (${beatSec.toFixed(2)}s). Snap edits to the kick marker.`;
    }
    if (intensity === "medium") {
      return `${bpm.toFixed(0)} BPM → cut every 2 beats (${(beatSec * 2).toFixed(2)}s). Hold on the visual hook.`;
    }
    return `${bpm.toFixed(0)} BPM → hold for 4 beats (${(beatSec * 4).toFixed(2)}s). Let the shot breathe.`;
  }
  if (intensity === "explosive" || intensity === "high") return "Snappy cuts — 0.5-1s holds. No drift.";
  if (intensity === "medium") return "Standard cuts — 1.5-3s holds. Cut on movement.";
  return "Long holds — 3-6s. Let the audience feel the frame.";
}

function audioSyncNote(scene: StoryboardScene, project: Project): string {
  const total = project.durationSec ?? scene.endSec;
  const section = songSection(scene.startSec, total);
  const startStr = fmt(scene.startSec);
  return `${startStr} → ${fmt(scene.endSec)} · ${section}. Drop a green beat marker at ${startStr} in your editor's timeline.`;
}

function buildPrompt(scene: StoryboardScene): string {
  // Prefer the AI prompt that already lives on the scene; fall back to a
  // composed prompt derived from the scene's structured fields.
  if (scene.aiPrompt && scene.aiPrompt.trim().length > 0) return scene.aiPrompt;
  return [
    scene.description,
    scene.shotType ? `Shot: ${scene.shotType}` : null,
    scene.cameraMovement ? `Camera: ${scene.cameraMovement}` : null,
    scene.lighting ? `Lighting: ${scene.lighting}` : null,
    scene.colorPalette ? `Palette: ${scene.colorPalette}` : null,
    scene.wardrobe ? `Wardrobe: ${scene.wardrobe}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// The 6-step workflow (verbatim from the spec, with our tool hints)
// ---------------------------------------------------------------------------

export const WORKFLOW: WorkflowStep[] = [
  {
    step: 1,
    title: "Generate key images",
    detail:
      "Make ONE crisp keyframe per scene before touching any video tool. Composition, palette, and character consistency all get locked here.",
    toolHints: ["Stable Diffusion (free, local)", "Midjourney v6", "Leonardo.ai", "Flux.1"],
  },
  {
    step: 2,
    title: "Animate images into video clips",
    detail:
      "Feed each keyframe into an image-to-video tool with the camera-motion prompt. Generate at the highest resolution your tier allows; you can downscale later.",
    toolHints: ["Runway Gen-3 (paid)", "Kling 1.6 (free tier)", "Luma Dream Machine", "Pika 1.5", "AnimateDiff (local)"],
  },
  {
    step: 3,
    title: "Import clips into CapCut or DaVinci Resolve",
    detail:
      "Drop every clip into one bin, label by scene number. Both editors are free; pick CapCut for mobile/quick turnaround, DaVinci for color and 4K finishing.",
    toolHints: ["CapCut (mobile + desktop, free)", "DaVinci Resolve (desktop, free)"],
  },
  {
    step: 4,
    title: "Align clips to beat markers",
    detail:
      "Drop a green beat marker on every kick (your project BPM is right there in this app). Snap clip in-points to those markers. This single step makes the cut feel professional.",
    toolHints: ["DaVinci: SHIFT+B to snap", "CapCut: tap-to-beat tool"],
  },
  {
    step: 5,
    title: "Add lyrics / text overlays",
    detail:
      "Use your timestamped lyrics from the Lyrics page (export to .srt or paste manually). Keep type tight — one line at a time, in-frame for ≥1s, with a 6-frame fade.",
    toolHints: ["DaVinci: Fusion text+", "CapCut: Auto Captions"],
  },
  {
    step: 6,
    title: "Export final video",
    detail:
      "Master at 1080p H.264 25-30 Mbps for YouTube + a 9:16 vertical export at 1080×1920 for TikTok/Reels/Shorts. Loudness target: -14 LUFS for all music platforms.",
    toolHints: ["YouTube preset", "TikTok/Reels 9:16", "-14 LUFS audio target"],
  },
];

// ---------------------------------------------------------------------------
// Full render checklist
// ---------------------------------------------------------------------------

export function buildChecklist(project: Project, sceneCount: number): ChecklistGroup[] {
  const a = project.artist ?? "your";
  const t = project.title;
  return [
    {
      label: "Pre-production",
      items: [
        `Audio master ready (${t}.wav or .mp3, -14 LUFS, no clipping).`,
        `Project metadata locked (title, artist, BPM, key) — used by every export.`,
        `Storyboard generated and reviewed scene-by-scene (${sceneCount} scenes).`,
        `Brand preset applied (palette + style) so all images stay consistent.`,
        `Lyrics page populated with timestamps for overlay alignment.`,
      ],
    },
    {
      label: "Image generation",
      items: [
        `One keyframe per scene (${sceneCount} images total).`,
        `Same character description used in every prompt for visual continuity.`,
        `Same color palette referenced in every prompt.`,
        `Negative prompt applied to all images (avoid extra fingers, watermarks, text artifacts).`,
        `Save at native resolution (≥ 1024×576 for 16:9, ≥ 720×1280 for 9:16).`,
      ],
    },
    {
      label: "Video generation",
      items: [
        `Camera motion in every prompt matches the scene's camera direction.`,
        `Generate at 5s clips minimum (most tools cap free tier here).`,
        `Re-roll any clip with morphing faces, broken hands, or wrong colors.`,
        `Stash all clips in /clips/scene-XX/ folder, numbered.`,
        `Total clips ≥ ${sceneCount} (one per scene minimum).`,
      ],
    },
    {
      label: "Editing & sync",
      items: [
        `Audio dropped on track 1, locked.`,
        `Beat markers placed (every kick) using the BPM in this app.`,
        `Clips snapped to beat markers, not to playhead estimation.`,
        `Cuts on the kick, not on the snare (unless intentional whip).`,
        `Transitions added per scene (see plan below).`,
      ],
    },
    {
      label: "Polish",
      items: [
        `Lyric overlays in, ≥1s on screen, ≤2 lines visible at once.`,
        `Color grade pass (lift shadows, saturate mids, gentle filmic curve).`,
        `Audio compression on master (-14 LUFS, true peak ≤ -1 dBTP).`,
        `Watermark / logo bug if part of brand preset.`,
        `Title card at start (artist + song) and end card with handle / link.`,
      ],
    },
    {
      label: "Export & deliverables",
      items: [
        `1920×1080 H.264 master for YouTube (25-30 Mbps).`,
        `1080×1920 vertical 9:16 cut-down for TikTok / Reels / Shorts.`,
        `1080×1080 1:1 cut-down for Instagram feed.`,
        `Thumbnail PNG at 1280×720 (use Marketing → Thumbnail Prompt).`,
        `Cover art PNG at 3000×3000 (use Marketing → Cover Art Prompt).`,
        `Captions exported as .srt (for YouTube auto-captions).`,
        `Backup the full project folder before uploading anywhere — ${a} doesn't get a do-over.`,
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function buildRenderPlan(
  project: Project,
  scenes: StoryboardScene[],
): RenderPlan {
  const ordered = [...scenes].sort((a, b) => a.index - b.index);
  const totalRuntimeSec =
    project.durationSec ??
    (ordered.length > 0 ? ordered[ordered.length - 1]!.endSec : 0);

  const rows: ScenePlanRow[] = ordered.map((scene, i) => {
    const next = ordered[i + 1] ?? null;
    const dur = clipDuration(scene);
    return {
      index: scene.index,
      sceneId: scene.id,
      title: scene.title,
      startSec: scene.startSec,
      endSec: scene.endSec,
      imageTool: pickImageTool(scene),
      videoTool: pickVideoTool(scene),
      prompt: buildPrompt(scene),
      clipDurationSec: dur.sec,
      clipDurationNote: dur.note,
      transitionToNext: transitionToNext(scene, next),
      editingNote: editingNote(scene, project),
      audioSyncNote: audioSyncNote(scene, project),
    };
  });

  return {
    scenes: rows,
    totalRuntimeSec,
    workflow: WORKFLOW,
    checklist: buildChecklist(project, ordered.length),
  };
}

// ---------------------------------------------------------------------------
// Plain-text serializer (Copy-all + future export hook)
// ---------------------------------------------------------------------------

export function renderPlanToText(project: Project, plan: RenderPlan): string {
  const lines: string[] = [];
  const title = project.artist ? `${project.title} — ${project.artist}` : project.title;
  lines.push("==============================================================");
  lines.push(`LOCAL RENDER PLAN — ${title}`);
  lines.push(`Total runtime: ${fmt(plan.totalRuntimeSec)} · Scenes: ${plan.scenes.length}`);
  if (project.bpm) lines.push(`BPM: ${Math.round(project.bpm)}${project.keySignature ? ` · Key: ${project.keySignature}` : ""}`);
  lines.push("==============================================================");
  lines.push("");
  lines.push("▼ RECOMMENDED FREE/CHEAP WORKFLOW");
  for (const w of plan.workflow) {
    lines.push(`${w.step}. ${w.title}`);
    lines.push(`   ${w.detail}`);
    lines.push(`   Tools: ${w.toolHints.join(" · ")}`);
    lines.push("");
  }
  lines.push("▼ FULL RENDER CHECKLIST");
  for (const g of plan.checklist) {
    lines.push(`-- ${g.label} --`);
    for (const item of g.items) lines.push(`  [ ] ${item}`);
    lines.push("");
  }
  lines.push("▼ PER-SCENE PRODUCTION PLAN");
  for (const s of plan.scenes) {
    lines.push(`──────────────────────────────────────────────────────────────`);
    lines.push(`Scene #${s.index + 1} — ${s.title}  [${fmt(s.startSec)} → ${fmt(s.endSec)}]`);
    lines.push(`  Image tool: ${s.imageTool.name} (${s.imageTool.cost})`);
    lines.push(`             ↳ ${s.imageTool.reason}`);
    lines.push(`  Video tool: ${s.videoTool.name} (${s.videoTool.cost})`);
    lines.push(`             ↳ ${s.videoTool.reason}`);
    lines.push(`  Prompt to paste:`);
    lines.push(`    ${s.prompt}`);
    lines.push(`  Clip duration: ${s.clipDurationSec}s — ${s.clipDurationNote}`);
    lines.push(`  Transition to next: ${s.transitionToNext}`);
    lines.push(`  Editing note: ${s.editingNote}`);
    lines.push(`  Audio sync: ${s.audioSyncNote}`);
    lines.push("");
  }
  return lines.join("\n");
}
