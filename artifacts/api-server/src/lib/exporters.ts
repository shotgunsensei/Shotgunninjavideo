import type {
  Project,
  StoryboardScene,
  TimelineSegment,
  AnalysisRow,
  LyricLine,
  Continuity,
  Prompt,
} from "@workspace/db";
import {
  PLATFORMS,
  buildScenePromptEngineRow,
  type ScenePromptEngineRow,
} from "./promptEngine";

export const EXPORT_FORMATS = [
  "production_plan",
  "txt",
  "json",
  "csv_shot_list",
  "lyrics_timing",
  "ai_prompt_pack",
  "capcut_guide",
  "davinci_guide",
  "treatment",
  "social_captions",
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface FormatMeta {
  ext: string;
  mime: string;
  label: string;
  description: string;
}

export const FORMAT_META: Record<ExportFormat, FormatMeta> = {
  production_plan: {
    ext: "txt",
    mime: "text/plain",
    label: "Production plan",
    description: "Call sheet, wardrobe, shot list, continuity, editing notes.",
  },
  txt: {
    ext: "txt",
    mime: "text/plain",
    label: "Full production TXT",
    description: "Scene-by-scene plain-text dump with structured prompts.",
  },
  json: {
    ext: "json",
    mime: "application/json",
    label: "JSON project file",
    description: "Machine-readable full project state for backups & APIs.",
  },
  csv_shot_list: {
    ext: "csv",
    mime: "text/csv",
    label: "CSV shot list",
    description: "Spreadsheet-ready shot list (Excel, Sheets, Numbers).",
  },
  lyrics_timing: {
    ext: "txt",
    mime: "text/plain",
    label: "Lyrics timing sheet",
    description: "Timecoded lyric lines mapped to scenes.",
  },
  ai_prompt_pack: {
    ext: "txt",
    mime: "text/plain",
    label: "AI video prompt pack",
    description: "Per-scene prompts formatted for every supported AI model.",
  },
  capcut_guide: {
    ext: "md",
    mime: "text/markdown",
    label: "CapCut edit guide",
    description: "Mobile editing recipe with beat markers & cut tempo.",
  },
  davinci_guide: {
    ext: "md",
    mime: "text/markdown",
    label: "DaVinci Resolve edit guide",
    description: "Pro NLE recipe with color, audio markers & delivery presets.",
  },
  treatment: {
    ext: "md",
    mime: "text/markdown",
    label: "Client treatment",
    description: "Polished, client-facing creative treatment document.",
  },
  social_captions: {
    ext: "txt",
    mime: "text/plain",
    label: "Social caption pack",
    description: "Captions sized for YouTube, TikTok, Reels, Feed, X, Facebook.",
  },
};

export interface ExportContext {
  project: Project;
  scenes: StoryboardScene[];
  prompts: Prompt[];
  segments: TimelineSegment[];
  analysis: AnalysisRow | undefined;
  lyrics: LyricLine[];
  continuity: Continuity | undefined;
  defaultAspectRatio: string;
  defaultDurationSec: number;
}

const ASPECT_RATIOS = [
  {
    label: "16:9 YouTube",
    code: "16:9",
    use: "YouTube long-form, primary deliverable, broadcast.",
  },
  {
    label: "9:16 TikTok / Reels / Shorts",
    code: "9:16",
    use: "TikTok, Instagram Reels, YouTube Shorts.",
  },
  {
    label: "1:1 Social Square",
    code: "1:1",
    use: "Instagram square posts, X feed thumbnails, podcast art frames.",
  },
  {
    label: "4:5 Facebook / Instagram Feed",
    code: "4:5",
    use: "Facebook & Instagram vertical feed posts.",
  },
];

function tc(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m.toString().padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function projectHeaderLines(ctx: ExportContext): string[] {
  const { project, analysis, segments, scenes } = ctx;
  const lines: string[] = [];
  lines.push(`Project: ${project.title}`);
  if (project.artist) lines.push(`Artist: ${project.artist}`);
  if (project.genre) lines.push(`Genre: ${project.genre}`);
  if (project.mood) lines.push(`Mood: ${project.mood}`);
  if (project.visualStyle) lines.push(`Visual style: ${project.visualStyle}`);
  if (project.brandDirection) lines.push(`Brand direction: ${project.brandDirection}`);
  if (analysis) {
    const loud =
      analysis.loudnessDb != null ? ` | loudness ${analysis.loudnessDb.toFixed(1)} dB` : "";
    lines.push(
      `Audio: ${analysis.durationSec.toFixed(1)}s @ ${analysis.bpm} BPM in ${analysis.keySignature} | energy ${analysis.energy.toFixed(2)}${loud}`,
    );
  } else if (project.durationSec || project.bpm) {
    lines.push(
      `Audio: ${(project.durationSec ?? 0).toFixed(1)}s @ ${project.bpm ?? "?"} BPM`,
    );
  }
  lines.push(`Sections: ${segments.length} | Scenes: ${scenes.length}`);
  return lines;
}

function aspectRatioBlock(): string[] {
  const lines = ["SUGGESTED ASPECT RATIOS", "-----------------------"];
  for (const a of ASPECT_RATIOS) {
    lines.push(`- ${a.label} (${a.code}) — ${a.use}`);
  }
  return lines;
}

function audioSummaryBlock(ctx: ExportContext): string[] {
  const lines: string[] = ["AUDIO ANALYSIS", "--------------"];
  const { analysis, segments } = ctx;
  if (analysis) {
    lines.push(`Duration: ${analysis.durationSec.toFixed(2)}s`);
    lines.push(`BPM: ${analysis.bpm}`);
    lines.push(`Key: ${analysis.keySignature}`);
    lines.push(`Energy: ${analysis.energy.toFixed(2)}`);
    if (analysis.loudnessDb != null) {
      lines.push(`Integrated loudness: ${analysis.loudnessDb.toFixed(1)} dB`);
    }
  } else {
    lines.push("(no analysis available)");
  }
  if (segments.length > 0) {
    lines.push("");
    lines.push("Sections:");
    for (const seg of segments) {
      lines.push(
        `  ${tc(seg.startSec)}–${tc(seg.endSec)}  ${seg.section.padEnd(10)} ${seg.emotion.padEnd(10)} intensity ${seg.intensity.toFixed(2)}`,
      );
    }
  }
  return lines;
}

function sceneTimelineBlock(ctx: ExportContext): string[] {
  const lines = ["SCENE TIMELINE", "--------------"];
  for (const s of ctx.scenes) {
    lines.push(
      `#${(s.index + 1).toString().padStart(2, "0")} ${tc(s.startSec)}–${tc(s.endSec)}  ${s.title}`,
    );
  }
  return lines;
}

function buildRowsForCtx(ctx: ExportContext): ScenePromptEngineRow[] {
  return ctx.scenes.map((scene) =>
    buildScenePromptEngineRow({
      scene,
      project: {
        title: ctx.project.title,
        artist: ctx.project.artist,
        genre: ctx.project.genre,
        mood: ctx.project.mood,
        visualStyle: ctx.project.visualStyle,
        visualDirection: ctx.project.visualDirection,
        brandDirection: ctx.project.brandDirection,
      },
      defaultAspectRatio: ctx.defaultAspectRatio,
      defaultDurationSec: ctx.defaultDurationSec,
      continuity: ctx.continuity ?? null,
    }),
  );
}

// ───────────────── Builders ─────────────────

function buildJson(ctx: ExportContext): string {
  const rows = buildRowsForCtx(ctx);
  return JSON.stringify(
    {
      project: ctx.project,
      audio: ctx.analysis,
      segments: ctx.segments,
      scenes: ctx.scenes,
      lyrics: ctx.lyrics,
      continuity: ctx.continuity,
      aspectRatios: ASPECT_RATIOS,
      promptRows: rows,
    },
    null,
    2,
  );
}

function buildTxt(ctx: ExportContext): string {
  const rows = buildRowsForCtx(ctx);
  const lines: string[] = [];
  lines.push(`# ${ctx.project.title.toUpperCase()}`);
  lines.push("=".repeat(Math.max(20, ctx.project.title.length + 2)));
  lines.push(...projectHeaderLines(ctx));
  lines.push("");
  lines.push(...audioSummaryBlock(ctx));
  lines.push("");
  lines.push(...sceneTimelineBlock(ctx));
  lines.push("");
  lines.push(...aspectRatioBlock());
  lines.push("");
  lines.push("STORYBOARD & PROMPTS");
  lines.push("--------------------");
  for (const s of ctx.scenes) {
    const row = rows.find((r) => r.sceneId === s.id);
    lines.push(`### Scene ${s.index + 1} ${tc(s.startSec)}–${tc(s.endSec)} — ${s.title}`);
    lines.push(`Shot: ${s.shotType} | Camera: ${s.cameraMovement}`);
    lines.push(`Location: ${s.location}`);
    lines.push(`Lighting: ${s.lighting}`);
    lines.push(`Palette: ${s.colorPalette}`);
    if (s.wardrobe) lines.push(`Wardrobe: ${s.wardrobe}`);
    lines.push(`Description: ${s.description}`);
    if (s.notes) lines.push(`Notes: ${s.notes}`);
    if (row) {
      lines.push("");
      lines.push("Structured prompt:");
      lines.push(`  Subject: ${row.block.subject}`);
      lines.push(`  Setting: ${row.block.setting}`);
      lines.push(`  Style: ${row.block.visualStyle}`);
      lines.push(`  Mood: ${row.block.mood}`);
      lines.push(`  Camera motion: ${row.block.cameraMotion}`);
      lines.push(`  Lighting: ${row.block.lighting}`);
      lines.push(`  Palette: ${row.block.colorPalette}`);
      lines.push(
        `  Aspect: ${row.block.aspectRatio} | Duration: ${row.block.durationSec}s`,
      );
      lines.push(`  Negative: ${row.block.negativePrompt}`);
      lines.push(`  Transition out: ${row.block.transition}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Defuse CSV formula injection (Excel/Sheets/Numbers all execute leading
  // =, +, -, @, tab, CR formulas) by prefixing with an apostrophe.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsvShotList(ctx: ExportContext): string {
  const rows = buildRowsForCtx(ctx);
  const lines: string[] = [];
  // Metadata + aspect-ratio guidance carried as `#`-prefixed rows so the file
  // remains valid CSV. Excel/Sheets render them as single-cell informational
  // rows above the data header.
  lines.push(`# Shotgun Ninjas — CSV Shot List`);
  for (const h of projectHeaderLines(ctx)) lines.push(`# ${h}`);
  lines.push(`# Suggested aspect ratios:`);
  for (const a of ASPECT_RATIOS) lines.push(`#   - ${a.label} (${a.code}) — ${a.use}`);
  lines.push(`#`);
  const header = [
    "scene",
    "start_sec",
    "end_sec",
    "duration_sec",
    "title",
    "shot_type",
    "camera_movement",
    "location",
    "lighting",
    "color_palette",
    "wardrobe",
    "description",
    "subject",
    "negative_prompt",
    "aspect_ratio",
    "transition_out",
  ].join(",");
  lines.push(header);
  for (const s of ctx.scenes) {
    const r = rows.find((x) => x.sceneId === s.id);
    lines.push(
      [
        s.index + 1,
        s.startSec.toFixed(2),
        s.endSec.toFixed(2),
        (s.endSec - s.startSec).toFixed(2),
        s.title,
        s.shotType,
        s.cameraMovement,
        s.location,
        s.lighting,
        s.colorPalette,
        s.wardrobe ?? "",
        s.description,
        r?.block.subject ?? "",
        r?.block.negativePrompt ?? "",
        r?.block.aspectRatio ?? ctx.defaultAspectRatio,
        r?.block.transition ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

function editingNotesBlock(ctx: ExportContext): string[] {
  const rows = buildRowsForCtx(ctx);
  const lines: string[] = ["EDITING NOTES", "-------------"];
  if (rows.length === 0) lines.push("(no scenes)");
  for (const r of rows) {
    lines.push(
      `Scene ${r.sceneIndex + 1} (${tc(r.startSec)}–${tc(r.endSec)}): ${r.block.transition}`,
    );
  }
  return lines;
}

function scenePromptsBlock(ctx: ExportContext): string[] {
  const rows = buildRowsForCtx(ctx);
  const lines: string[] = ["SCENE PROMPTS", "-------------"];
  if (rows.length === 0) lines.push("(no scenes)");
  for (const r of rows) {
    lines.push(
      `Scene ${r.sceneIndex + 1} — ${r.sceneTitle} [${r.block.aspectRatio}, ${r.block.durationSec}s]`,
    );
    lines.push(`  ${r.block.subject}`);
    lines.push(`  Setting: ${r.block.setting}`);
    lines.push(`  Style: ${r.block.visualStyle} | Mood: ${r.block.mood}`);
    lines.push(`  Camera: ${r.block.cameraMotion} | Lighting: ${r.block.lighting}`);
    lines.push(`  Negative: ${r.block.negativePrompt}`);
  }
  return lines;
}

function buildProductionPlan(ctx: ExportContext): string {
  const rows = buildRowsForCtx(ctx);
  const lines: string[] = [];
  lines.push("SHOTGUN NINJAS — PRODUCTION PLAN");
  lines.push("================================");
  lines.push(...projectHeaderLines(ctx));
  lines.push("");
  lines.push(...audioSummaryBlock(ctx));
  lines.push("");
  lines.push("CALL SHEET");
  lines.push("----------");
  const locations = Array.from(
    new Set(ctx.scenes.map((s) => s.location).filter(Boolean)),
  );
  if (locations.length === 0) lines.push("(no locations specified)");
  locations.forEach((loc, i) => lines.push(`Location ${i + 1}: ${loc}`));
  lines.push("");
  lines.push("WARDROBE");
  lines.push("--------");
  const wardrobe = Array.from(
    new Set(ctx.scenes.map((s) => s.wardrobe).filter((w): w is string => !!w)),
  );
  if (wardrobe.length === 0) lines.push("(none specified)");
  wardrobe.forEach((w) => lines.push(`- ${w}`));
  lines.push("");
  if (ctx.continuity) {
    lines.push(
      `CONTINUITY (LOCK ${ctx.continuity.lockEnabled ? "ON" : "OFF"})`,
    );
    lines.push("------------------------");
    if (ctx.continuity.mainCharacter)
      lines.push(`Character: ${ctx.continuity.mainCharacter}`);
    if (ctx.continuity.outfit) lines.push(`Outfit: ${ctx.continuity.outfit}`);
    if (ctx.continuity.faceStyle) lines.push(`Face: ${ctx.continuity.faceStyle}`);
    if (ctx.continuity.locationWorld)
      lines.push(`World: ${ctx.continuity.locationWorld}`);
    if (ctx.continuity.environmentRules)
      lines.push(`World rules: ${ctx.continuity.environmentRules}`);
    if (ctx.continuity.colorPalette)
      lines.push(`Palette: ${ctx.continuity.colorPalette}`);
    if (ctx.continuity.brandStyle)
      lines.push(`Brand: ${ctx.continuity.brandStyle}`);
    if (ctx.continuity.recurringMotifs)
      lines.push(`Motifs: ${ctx.continuity.recurringMotifs}`);
    if (ctx.continuity.negativePromptLibrary)
      lines.push(`Avoid: ${ctx.continuity.negativePromptLibrary}`);
    lines.push("");
  }
  lines.push("SHOT LIST");
  lines.push("---------");
  for (const s of ctx.scenes) {
    lines.push(
      `#${s.index + 1} [${tc(s.startSec)}–${tc(s.endSec)}] ${s.shotType} / ${s.cameraMovement} — ${s.title}`,
    );
    if (s.description) lines.push(`    ${s.description}`);
  }
  lines.push("");
  lines.push("EDITING NOTES");
  lines.push("-------------");
  for (const r of rows) {
    lines.push(`Scene ${r.sceneIndex + 1}: ${r.block.transition}`);
  }
  lines.push("");
  lines.push(...aspectRatioBlock());
  return lines.join("\n");
}

function buildLyricsTiming(ctx: ExportContext): string {
  const lines: string[] = [];
  lines.push("LYRICS TIMING SHEET");
  lines.push("===================");
  lines.push(...projectHeaderLines(ctx));
  lines.push("");
  lines.push(...audioSummaryBlock(ctx));
  lines.push("");
  lines.push(...sceneTimelineBlock(ctx));
  lines.push("");
  if (ctx.lyrics.length === 0) {
    lines.push("LYRICS");
    lines.push("------");
    lines.push("(no lyric lines on file — go to Lyrics page to import or paste lyrics)");
    lines.push("");
    lines.push(...scenePromptsBlock(ctx));
    lines.push("");
    lines.push(...editingNotesBlock(ctx));
    lines.push("");
    lines.push(...aspectRatioBlock());
    return lines.join("\n");
  }
  const sceneById = new Map(ctx.scenes.map((s) => [s.id, s]));
  const sortedLyrics = [...ctx.lyrics].sort((a, b) => {
    if (a.timestampSec != null && b.timestampSec != null)
      return a.timestampSec - b.timestampSec;
    if (a.timestampSec != null) return -1;
    if (b.timestampSec != null) return 1;
    return a.index - b.index;
  });
  lines.push("TIMECODE   | SCENE | LINE");
  lines.push("-----------|-------|--------------------------------------------");
  for (const line of sortedLyrics) {
    const ts = line.timestampSec != null ? tc(line.timestampSec) : "  --:--  ";
    const scene = line.sceneId ? sceneById.get(line.sceneId) : undefined;
    const sceneTag = scene
      ? `S${(scene.index + 1).toString().padStart(2, "0")}`
      : "  -";
    lines.push(`${ts.padEnd(10)} | ${sceneTag.padEnd(5)} | ${line.text}`);
  }
  lines.push("");
  lines.push("PER-SCENE GROUPING");
  lines.push("------------------");
  for (const s of ctx.scenes) {
    const sceneLines = sortedLyrics.filter((l) => l.sceneId === s.id);
    if (sceneLines.length === 0) continue;
    lines.push("");
    lines.push(`Scene ${s.index + 1} ${tc(s.startSec)}–${tc(s.endSec)} — ${s.title}`);
    for (const l of sceneLines) lines.push(`  ${l.text}`);
  }
  lines.push("");
  lines.push(...scenePromptsBlock(ctx));
  lines.push("");
  lines.push(...editingNotesBlock(ctx));
  lines.push("");
  lines.push(...aspectRatioBlock());
  return lines.join("\n");
}

function buildAiPromptPack(ctx: ExportContext): string {
  const rows = buildRowsForCtx(ctx);
  const videoPlatforms = PLATFORMS.filter((p) => p.kind === "video");
  const imagePlatforms = PLATFORMS.filter((p) => p.kind === "image");
  const lines: string[] = [];
  lines.push("AI VIDEO PROMPT PACK");
  lines.push("====================");
  lines.push(...projectHeaderLines(ctx));
  lines.push("");
  lines.push(...aspectRatioBlock());
  lines.push("");
  lines.push("Each scene below is provided in two flavors: VIDEO models and IMAGE models.");
  lines.push("Paste the relevant block into your tool of choice.");
  lines.push("");
  for (const r of rows) {
    lines.push("============================================================");
    lines.push(
      `SCENE ${r.sceneIndex + 1} | ${tc(r.startSec)}–${tc(r.endSec)} | ${r.sceneTitle}`,
    );
    lines.push(
      `Shot: ${r.shotType}  Camera: ${r.cameraMovement}  Aspect: ${r.block.aspectRatio}  Duration: ${r.block.durationSec}s`,
    );
    lines.push("============================================================");
    lines.push("");
    lines.push("--- VIDEO MODELS ---");
    for (const p of videoPlatforms) {
      lines.push(`[${p.label}]`);
      lines.push(r.platforms[p.id] ?? "");
      lines.push("");
    }
    lines.push("--- IMAGE MODELS ---");
    for (const p of imagePlatforms) {
      lines.push(`[${p.label}]`);
      lines.push(r.platforms[p.id] ?? "");
      lines.push("");
    }
  }
  return lines.join("\n");
}

function buildCapCutGuide(ctx: ExportContext): string {
  const rows = buildRowsForCtx(ctx);
  const bpm = ctx.analysis?.bpm ?? 120;
  const lines: string[] = [];
  lines.push(`# CapCut Edit Guide — ${ctx.project.title}`);
  if (ctx.project.artist) lines.push(`### ${ctx.project.artist}`);
  lines.push("");
  lines.push(...projectHeaderLines(ctx));
  lines.push("");
  lines.push("## Project setup");
  lines.push("- Import your audio first; CapCut will lock to its waveform.");
  lines.push(
    "- Set canvas to **9:16** for TikTok/Reels/Shorts (primary). Duplicate the project for **1:1** and **4:5** crops.",
  );
  lines.push(
    `- BPM: ${bpm} — enable Beat Markers under \`Audio > Beats > Auto\`. Beats land every ${(60 / bpm).toFixed(2)}s.`,
  );
  lines.push("");
  lines.push("## Beat-mapped section guide");
  if (ctx.segments.length === 0) lines.push("_no audio sections detected_");
  for (const seg of ctx.segments) {
    const sectionBpm = seg.bpm ?? bpm;
    const cutEvery = Math.max(1, Math.round((60 / sectionBpm) * 4));
    lines.push(
      `- **${tc(seg.startSec)}–${tc(seg.endSec)}** ${seg.section} — energy ${seg.intensity.toFixed(2)}, ${seg.emotion}. Cut every ~${cutEvery}s (4 beats).`,
    );
  }
  lines.push("");
  lines.push("## Scene-by-scene edit recipe");
  for (const r of rows) {
    const editing = r.platforms.capcut ?? "";
    lines.push(`### Scene ${r.sceneIndex + 1} — ${r.sceneTitle}`);
    lines.push(
      `Time: ${tc(r.startSec)}–${tc(r.endSec)}  ·  Shot: ${r.shotType}  ·  Camera: ${r.cameraMovement}`,
    );
    lines.push("");
    lines.push(editing);
    lines.push("");
    lines.push(`**Transition out:** ${r.block.transition}`);
    lines.push("");
  }
  lines.push("## Aspect ratio deliverables");
  for (const a of ASPECT_RATIOS) lines.push(`- ${a.label} (${a.code}) — ${a.use}`);
  return lines.join("\n");
}

function buildDavinciGuide(ctx: ExportContext): string {
  const rows = buildRowsForCtx(ctx);
  const lines: string[] = [];
  lines.push(`# DaVinci Resolve Edit Guide — ${ctx.project.title}`);
  if (ctx.project.artist) lines.push(`### ${ctx.project.artist}`);
  lines.push("");
  lines.push(...projectHeaderLines(ctx));
  lines.push("");
  lines.push("## Project & timeline setup");
  lines.push(
    "- Create a **1080×1920 9:16** master timeline; nest into a **3840×2160 16:9** delivery timeline using Reframe.",
  );
  lines.push("- Set timeline frame rate to **24fps** (drop-frame off).");
  lines.push(
    `- BPM: **${ctx.analysis?.bpm ?? "?"}** — generate audio markers via \`Fairlight > Audio > Beat Detection\`.`,
  );
  lines.push(
    "- Color page: start every scene from a base LUT, then grade per scene palette.",
  );
  lines.push("");
  lines.push("## Sections (audio analysis)");
  if (ctx.segments.length === 0) lines.push("_no audio sections detected_");
  for (const seg of ctx.segments) {
    lines.push(
      `- **${tc(seg.startSec)}–${tc(seg.endSec)}** ${seg.section} — ${seg.emotion}, intensity ${seg.intensity.toFixed(2)}`,
    );
  }
  lines.push("");
  lines.push("## Scene-by-scene grading & cut sheet");
  for (const r of rows) {
    const scene = ctx.scenes.find((s) => s.id === r.sceneId);
    lines.push(`### Scene ${r.sceneIndex + 1} — ${r.sceneTitle}`);
    lines.push(
      `Time: ${tc(r.startSec)}–${tc(r.endSec)}  ·  Shot: ${r.shotType}  ·  Camera: ${r.cameraMovement}`,
    );
    lines.push(
      `Lighting: ${scene?.lighting ?? "—"}  ·  Palette: ${scene?.colorPalette ?? "—"}`,
    );
    lines.push("");
    lines.push(r.platforms.davinci ?? "");
    lines.push("");
    lines.push(`**Transition:** ${r.block.transition}`);
    lines.push("");
  }
  lines.push("## Delivery render presets");
  for (const a of ASPECT_RATIOS)
    lines.push(`- ${a.label} (${a.code}) — ${a.use}. Render: H.264, 18 Mbps, AAC 320kbps.`);
  return lines.join("\n");
}

function buildTreatment(ctx: ExportContext): string {
  const lines: string[] = [];
  const p = ctx.project;
  lines.push(`# ${p.title} — Music Video Treatment`);
  if (p.artist) lines.push(`### ${p.artist}`);
  lines.push("");
  lines.push("## Logline");
  const logline =
    p.visualDirection?.trim() ||
    p.mood?.trim() ||
    `${p.title} — a ${p.genre ?? "music"} performance directed for screen.`;
  lines.push(logline);
  lines.push("");
  lines.push("## Vision");
  if (p.brandDirection) lines.push(p.brandDirection);
  if (p.visualStyle) lines.push(`**Visual style:** ${p.visualStyle}`);
  if (p.mood) lines.push(`**Mood:** ${p.mood}`);
  if (
    ctx.continuity &&
    (ctx.continuity.mainCharacter ||
      ctx.continuity.locationWorld ||
      ctx.continuity.outfit)
  ) {
    lines.push("");
    lines.push("## Character & world");
    if (ctx.continuity.mainCharacter)
      lines.push(`- **Protagonist:** ${ctx.continuity.mainCharacter}`);
    if (ctx.continuity.outfit) lines.push(`- **Wardrobe:** ${ctx.continuity.outfit}`);
    if (ctx.continuity.locationWorld)
      lines.push(`- **World:** ${ctx.continuity.locationWorld}`);
    if (ctx.continuity.colorPalette)
      lines.push(`- **Palette:** ${ctx.continuity.colorPalette}`);
    if (ctx.continuity.recurringMotifs)
      lines.push(`- **Recurring motifs:** ${ctx.continuity.recurringMotifs}`);
  }
  lines.push("");
  lines.push("## Audio summary");
  if (ctx.analysis) {
    lines.push(`- Duration: ${ctx.analysis.durationSec.toFixed(1)} s`);
    lines.push(`- Tempo: ${ctx.analysis.bpm} BPM in ${ctx.analysis.keySignature}`);
    lines.push(`- Energy: ${ctx.analysis.energy.toFixed(2)}`);
    if (ctx.segments.length > 0) {
      lines.push("");
      lines.push("**Sections**");
      for (const seg of ctx.segments) {
        lines.push(
          `- ${tc(seg.startSec)}–${tc(seg.endSec)} · ${seg.section} · ${seg.emotion}`,
        );
      }
    }
  } else {
    lines.push("_(no audio analysis on file)_");
  }
  lines.push("");
  lines.push("## Sequence breakdown");
  for (const s of ctx.scenes) {
    lines.push(
      `### Scene ${s.index + 1} · ${tc(s.startSec)}–${tc(s.endSec)} · ${s.title}`,
    );
    lines.push(s.description || "_(no description)_");
    lines.push("");
    lines.push(
      `*${s.shotType}, ${s.cameraMovement}.* Location: ${s.location}. Lighting: ${s.lighting}. Palette: ${s.colorPalette}.`,
    );
    if (s.notes) lines.push(`> ${s.notes}`);
    lines.push("");
  }
  lines.push("## Scene prompts (production reference)");
  const promptRows = buildRowsForCtx(ctx);
  for (const r of promptRows) {
    lines.push(`- **Scene ${r.sceneIndex + 1}** — ${r.block.subject}`);
    lines.push(`  _Setting:_ ${r.block.setting}. _Style:_ ${r.block.visualStyle}.`);
  }
  lines.push("");
  lines.push("## Editing notes");
  for (const r of promptRows) {
    lines.push(`- Scene ${r.sceneIndex + 1}: ${r.block.transition}`);
  }
  lines.push("");
  lines.push("## Deliverables");
  for (const a of ASPECT_RATIOS) lines.push(`- ${a.label} (${a.code}) — ${a.use}`);
  lines.push("");
  lines.push("---");
  lines.push("_Prepared with the Shotgun Ninjas Video Engine._");
  return lines.join("\n");
}

function hashtagify(input: string | null | undefined): string {
  if (!input) return "";
  const cleaned = input.replace(/[^a-z0-9 ]+/gi, " ").trim();
  if (!cleaned) return "";
  return "#" + cleaned.split(/\s+/).join("");
}

function buildSocialCaptions(ctx: ExportContext): string {
  const p = ctx.project;
  const tags = [
    hashtagify(p.genre),
    hashtagify(p.mood),
    p.artist ? hashtagify(p.artist) : "",
    "#musicvideo",
    "#shotgunninjas",
  ].filter(Boolean);
  const tagline =
    p.visualDirection?.trim() ||
    p.mood?.trim() ||
    `${p.title}${p.artist ? ` by ${p.artist}` : ""}`;
  const teaser = ctx.scenes[0]?.description?.trim() || tagline;

  const lines: string[] = [];
  lines.push(`SOCIAL CAPTION PACK — ${p.title}`);
  lines.push("=".repeat(40));
  lines.push("");

  lines.push("--- YouTube (16:9) — 5000 char limit ---");
  lines.push(`${p.title}${p.artist ? ` // ${p.artist}` : ""}`);
  lines.push("");
  lines.push(tagline);
  lines.push("");
  if (ctx.scenes.length > 0) {
    lines.push("Chapters:");
    for (const s of ctx.scenes) {
      lines.push(`${tc(s.startSec)} ${s.title}`);
    }
    lines.push("");
  }
  lines.push(tags.join(" "));
  lines.push("");

  lines.push("--- TikTok (9:16) — 2200 char ---");
  lines.push(teaser.length > 140 ? `${teaser.slice(0, 137)}…` : teaser);
  lines.push(tags.slice(0, 5).join(" "));
  lines.push("");

  lines.push("--- Instagram Reels / Feed (9:16, 4:5) — 2200 char ---");
  lines.push(tagline);
  lines.push("");
  lines.push("▶ Watch the full video — link in bio.");
  lines.push(tags.slice(0, 8).join(" "));
  lines.push("");

  lines.push("--- Instagram Square (1:1) — single-image post ---");
  lines.push(`${p.title}${p.artist ? ` — ${p.artist}` : ""}.`);
  lines.push("Out now.");
  lines.push(tags.slice(0, 6).join(" "));
  lines.push("");

  lines.push("--- X / Twitter — 280 char ---");
  const xCaption = `${p.title}${p.artist ? ` — ${p.artist}` : ""}. ${tagline}`.slice(
    0,
    240,
  );
  lines.push(xCaption);
  lines.push(tags.slice(0, 3).join(" "));
  lines.push("");

  lines.push("--- Facebook (4:5 / 16:9) ---");
  lines.push(`New drop: ${p.title}${p.artist ? ` from ${p.artist}` : ""}.`);
  lines.push("");
  lines.push(tagline);
  lines.push("");
  lines.push(tags.join(" "));
  lines.push("");
  lines.push("");
  lines.push("==============================================");
  lines.push("PRODUCTION REFERENCE (for the social team)");
  lines.push("==============================================");
  lines.push("");
  lines.push(...projectHeaderLines(ctx));
  lines.push("");
  lines.push(...audioSummaryBlock(ctx));
  lines.push("");
  lines.push(...sceneTimelineBlock(ctx));
  lines.push("");
  lines.push(...scenePromptsBlock(ctx));
  lines.push("");
  lines.push(...editingNotesBlock(ctx));
  lines.push("");
  lines.push(...aspectRatioBlock());
  return lines.join("\n");
}

const BUILDERS: Record<ExportFormat, (ctx: ExportContext) => string> = {
  json: buildJson,
  txt: buildTxt,
  csv_shot_list: buildCsvShotList,
  production_plan: buildProductionPlan,
  lyrics_timing: buildLyricsTiming,
  ai_prompt_pack: buildAiPromptPack,
  capcut_guide: buildCapCutGuide,
  davinci_guide: buildDavinciGuide,
  treatment: buildTreatment,
  social_captions: buildSocialCaptions,
};

export function buildExport(format: ExportFormat, ctx: ExportContext): string {
  return BUILDERS[format](ctx);
}
