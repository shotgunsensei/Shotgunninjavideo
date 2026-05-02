import type {
  Project,
  StoryboardScene,
  BrandPreset,
  MarketingAssetKind,
} from "@workspace/db";
import { MARKETING_ASSET_KINDS } from "@workspace/db";

export interface MarketingContext {
  project: Project;
  scenes: StoryboardScene[];
  brandPreset: BrandPreset | null;
}

export interface MarketingKindMeta {
  kind: MarketingAssetKind;
  label: string;
  group: "platform" | "captions" | "video_plan" | "visual" | "content";
  description: string;
}

export const MARKETING_KIND_META: Record<MarketingAssetKind, MarketingKindMeta> = {
  youtube_titles: {
    kind: "youtube_titles",
    label: "YouTube Title Ideas",
    group: "platform",
    description: "8 SEO-tuned title variants — pick the strongest for upload.",
  },
  youtube_description: {
    kind: "youtube_description",
    label: "YouTube Description",
    group: "platform",
    description: "Long-form description with timestamps, credits, and tags.",
  },
  tiktok_caption: {
    kind: "tiktok_caption",
    label: "TikTok Caption",
    group: "captions",
    description: "Short, punchy caption tuned for TikTok algorithm + hashtags.",
  },
  instagram_caption: {
    kind: "instagram_caption",
    label: "Instagram Caption",
    group: "captions",
    description: "Aesthetic, mid-length caption for Reels & feed posts.",
  },
  facebook_caption: {
    kind: "facebook_caption",
    label: "Facebook Caption",
    group: "captions",
    description: "Warm, narrative caption for Facebook page posts.",
  },
  hashtags: {
    kind: "hashtags",
    label: "Hashtag Sets",
    group: "captions",
    description: "Three platform-tuned hashtag bundles (TikTok / IG / YouTube).",
  },
  teaser_15s: {
    kind: "teaser_15s",
    label: "15-Second Teaser Plan",
    group: "video_plan",
    description: "Cut plan for a 15-second TikTok / Reels / Shorts teaser.",
  },
  teaser_30s: {
    kind: "teaser_30s",
    label: "30-Second Teaser Plan",
    group: "video_plan",
    description: "Cut plan for a 30-second cross-platform teaser.",
  },
  trailer_60s: {
    kind: "trailer_60s",
    label: "60-Second Trailer Plan",
    group: "video_plan",
    description: "Cut plan for a 60-second cinematic trailer with hook + drop.",
  },
  thumbnail_prompt: {
    kind: "thumbnail_prompt",
    label: "Thumbnail Prompt",
    group: "visual",
    description: "AI-image prompt for a click-through YouTube thumbnail.",
  },
  cover_art_prompt: {
    kind: "cover_art_prompt",
    label: "Cover Art Prompt",
    group: "visual",
    description: "AI-image prompt for the single / album cover art.",
  },
  behind_the_scenes: {
    kind: "behind_the_scenes",
    label: "Behind-the-Scenes Post",
    group: "content",
    description: "Story-style BTS post for IG / FB / X.",
  },
  release_announcement: {
    kind: "release_announcement",
    label: "Release Announcement",
    group: "content",
    description: "Cross-platform release announcement copy.",
  },
};

export const MARKETING_KIND_GROUP_ORDER: MarketingKindMeta["group"][] = [
  "platform",
  "captions",
  "video_plan",
  "visual",
  "content",
];

export const MARKETING_GROUP_LABEL: Record<MarketingKindMeta["group"], string> = {
  platform: "Platform Copy",
  captions: "Social Captions",
  video_plan: "Cut-down Video Plans",
  visual: "Visual Asset Prompts",
  content: "Story Content",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tc(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function tagify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function pickScenes(scenes: StoryboardScene[], n: number): StoryboardScene[] {
  if (scenes.length <= n) return scenes;
  // Evenly sample to capture arc: first, n-2 in between, last.
  if (n <= 1) return [scenes[0]!];
  const step = (scenes.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => scenes[Math.round(i * step)]!);
}

function topByTally<T>(items: T[], keyFn: (t: T) => string | null | undefined, n: number): string[] {
  const tally = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it)?.trim();
    if (!k) continue;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
}

function lyricLines(project: Project, max: number): string[] {
  if (!project.lyrics) return [];
  return project.lyrics
    .split("\n")
    .map((l) => l.replace(/^\[[^\]]+\]\s*/, "").trim())
    .filter((l) => l.length > 0 && !l.startsWith("[") && !l.startsWith("#"))
    .slice(0, max);
}

function strongLyric(project: Project): string | null {
  const lines = lyricLines(project, 40);
  if (lines.length === 0) return null;
  // Prefer a mid-song line (often the strongest hook), within 40-80 chars.
  const mid = lines.slice(Math.floor(lines.length / 4), Math.floor((lines.length * 3) / 4));
  const candidate = mid.find((l) => l.length >= 30 && l.length <= 90) ?? lines[Math.floor(lines.length / 2)]!;
  return candidate.replace(/[—–-]+$/, "").trim();
}

// ---------------------------------------------------------------------------
// Generators (deterministic, derived from project metadata)
// ---------------------------------------------------------------------------

function genYouTubeTitles(ctx: MarketingContext): string {
  const { project } = ctx;
  const t = project.title;
  const a = project.artist ?? "Independent Artist";
  const g = project.genre ?? "Music";
  const styles = [
    `${a} — ${t} (Official Music Video)`,
    `${t} — ${a} | Official Video`,
    `${a} - "${t}" [Official ${g} Video]`,
    `${t} (Official Video) | ${a}`,
    `${a} drops "${t}" — Official Music Video [4K]`,
    `${t} // ${a} (Official Cinematic Video)`,
    `"${t}" - ${a} (Official ${g} Visual)`,
    `${a} — ${t} | Official Music Video ${new Date().getFullYear()}`,
  ];
  return styles.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

function genYouTubeDescription(ctx: MarketingContext): string {
  const { project, scenes, brandPreset } = ctx;
  const a = project.artist ?? "Independent Artist";
  const t = project.title;
  const g = project.genre ?? "music";
  const m = project.mood ?? "cinematic";
  const lines: string[] = [];
  lines.push(`${a} — "${t}" (Official Music Video)`);
  lines.push("");
  lines.push(
    project.brandDirection ||
      `A ${m} ${g} visual following the full arc of "${t}". Directed, edited, and color-graded by ${a}.`,
  );
  lines.push("");

  // Timestamps from scene structure
  if (scenes.length > 0) {
    lines.push("⏱ TIMESTAMPS");
    const sample = pickScenes(scenes, Math.min(8, scenes.length));
    for (const s of sample) {
      lines.push(`${tc(s.startSec)} — ${s.title}`);
    }
    lines.push("");
  }

  lines.push("🎬 CREDITS");
  lines.push(`Performed by: ${a}`);
  lines.push(`Genre: ${g}`);
  if (project.bpm) lines.push(`BPM: ${Math.round(project.bpm)}`);
  if (project.keySignature) lines.push(`Key: ${project.keySignature}`);
  if (brandPreset?.watermarkText) lines.push(`Production: ${brandPreset.watermarkText}`);
  lines.push("");

  lines.push("🔔 SUBSCRIBE for more music & visuals.");
  lines.push("📲 Follow & share — every share matters to independent artists.");
  lines.push("");

  // SEO tags
  const tags = uniq(
    [
      a,
      t,
      g,
      m,
      `${a} ${t}`,
      `${t} official video`,
      `${a} new music`,
      `${g} ${new Date().getFullYear()}`,
      "official music video",
      "music video",
    ].filter(Boolean) as string[],
  );
  lines.push("Tags: " + tags.join(", "));
  return lines.join("\n");
}

function genTikTokCaption(ctx: MarketingContext): string {
  const { project } = ctx;
  const hook = strongLyric(project) ?? `new ${project.genre ?? "track"} dropped 🔥`;
  const a = project.artist ?? "us";
  const tags = uniq(
    [
      "fyp",
      "musicvideo",
      "newmusic",
      tagify(project.genre ?? "music").toLowerCase(),
      tagify(project.title).toLowerCase(),
      tagify(a).toLowerCase(),
      "indieartist",
      "originalsound",
    ].filter(Boolean),
  ).slice(0, 8);
  return [
    `POV: ${hook} 👀`,
    "",
    `full video out now — link in bio 🔗`,
    "",
    tags.map((t) => `#${t}`).join(" "),
  ].join("\n");
}

function genInstagramCaption(ctx: MarketingContext): string {
  const { project, brandPreset } = ctx;
  const a = project.artist ?? "Us";
  const t = project.title;
  const m = project.mood ?? "cinematic";
  const hook = strongLyric(project) ?? `"${t}" — out now.`;
  const tone = brandPreset?.voiceTone
    ? `\n\n${brandPreset.voiceTone}`
    : "";
  const tags = uniq(
    [
      tagify(project.genre ?? "Music"),
      tagify(t),
      tagify(a),
      "MusicVideo",
      "NewMusic",
      "OfficialVideo",
      "IndieArtist",
      "Cinematic",
      `${tagify(m)}`,
    ].filter(Boolean),
  ).slice(0, 12);
  return [
    `"${hook}"`,
    "",
    `${a} — "${t}". The official music video is live.${tone}`,
    "",
    `Tap the link in bio to watch the full ${m} cut. Share with someone who needs to see it.`,
    "",
    tags.map((tag) => `#${tag}`).join(" "),
  ].join("\n");
}

function genFacebookCaption(ctx: MarketingContext): string {
  const { project } = ctx;
  const a = project.artist ?? "We";
  const t = project.title;
  const m = project.mood ?? "cinematic";
  const story =
    project.brandDirection ||
    `This is the world we built around "${t}" — every frame, every cut, every color was chosen to carry the ${m} weight of the song.`;
  return [
    `🎬 NEW MUSIC VIDEO — "${t}" by ${a}`,
    "",
    story,
    "",
    `Watch the full official music video on YouTube (link in the comments).`,
    "",
    `If it moves you, share it with one person who'd feel it too. That's how independent music travels.`,
    "",
    `— ${a}`,
  ].join("\n");
}

function genHashtags(ctx: MarketingContext): string {
  const { project } = ctx;
  const a = project.artist ?? "Artist";
  const t = project.title;
  const g = project.genre ?? "Music";
  const m = project.mood ?? "Cinematic";

  const core = [
    tagify(t),
    tagify(a),
    tagify(g),
    tagify(m),
  ].filter(Boolean);

  const tiktok = uniq([
    "fyp",
    "foryou",
    "foryoupage",
    "musicvideo",
    "newmusic",
    "originalsound",
    ...core.map((c) => c.toLowerCase()),
    "indieartist",
    "musictok",
    "viralmusic",
  ]).slice(0, 12);

  const instagram = uniq([
    ...core,
    "MusicVideo",
    "NewMusic",
    "OfficialVideo",
    "IndieArtist",
    "MusicProducer",
    "Cinematography",
    "MusicVideoDirector",
    "BehindTheScenes",
    "ReelsMusic",
    "ExplorePage",
    "MusicCommunity",
  ]).slice(0, 18);

  const youtube = uniq([
    ...core,
    "MusicVideo",
    "OfficialMusicVideo",
    "NewMusic",
    `New${tagify(g)}`,
    `${tagify(g)}${new Date().getFullYear()}`,
    "OfficialVideo",
    "IndependentArtist",
  ]).slice(0, 10);

  return [
    "▼ TIKTOK (use 3-6 of these per post)",
    tiktok.map((h) => `#${h}`).join(" "),
    "",
    "▼ INSTAGRAM (use 10-15 in first comment)",
    instagram.map((h) => `#${h}`).join(" "),
    "",
    "▼ YOUTUBE (drop into description)",
    youtube.map((h) => `#${h}`).join(" "),
  ].join("\n");
}

function buildTeaserPlan(ctx: MarketingContext, totalSec: number, label: string): string {
  const { project, scenes } = ctx;
  const t = project.title;
  const a = project.artist ?? "Artist";
  const lines: string[] = [];
  lines.push(`▼ ${label.toUpperCase()} — "${t}" by ${a}`);
  lines.push(`Total runtime: ${totalSec}s · Aspect: 9:16 vertical · Sound: original audio`);
  lines.push("");

  if (scenes.length === 0) {
    lines.push("(No storyboard scenes yet — generate the storyboard first for a tighter cut plan.)");
    return lines.join("\n");
  }

  // Beat blueprint per duration
  let beats: { secs: number; label: string }[];
  if (totalSec <= 15) {
    beats = [
      { secs: 2, label: "HOOK FRAME — strongest single visual, no text yet" },
      { secs: 4, label: "ESTABLISH — character + world reveal, 1 song bar" },
      { secs: 5, label: "DROP MOMENT — biggest motion + biggest beat" },
      { secs: 4, label: "CTA CARD — title + 'Out Now' + handle, hold 4s" },
    ];
  } else if (totalSec <= 30) {
    beats = [
      { secs: 3, label: "HOOK FRAME — opening shock value, no text" },
      { secs: 4, label: "INTRO — character close-up, song breath" },
      { secs: 6, label: "RISING ACT — 2 fast cuts on the build" },
      { secs: 8, label: "DROP / CHORUS — 3-4 beats of biggest visuals" },
      { secs: 5, label: "EMOTIONAL BEAT — slow shot, lyric-driven" },
      { secs: 4, label: "CTA CARD — title, artist, 'Watch full video', link" },
    ];
  } else {
    beats = [
      { secs: 4, label: "COLD OPEN — no music, single establishing shot" },
      { secs: 6, label: "TITLE FRAME — artist name + song title typography" },
      { secs: 10, label: "ACT 1 — 3 cuts on the verse, world-building" },
      { secs: 12, label: "ACT 2 — chorus drop, 4-5 cuts, biggest energy" },
      { secs: 10, label: "ACT 3 — emotional pivot, slow-motion centerpiece" },
      { secs: 10, label: "ACT 4 — return to chorus, montage, intensity peaks" },
      { secs: 6, label: "CLOSING IMAGE — final iconic frame, song hook lingers" },
      { secs: 2, label: "CTA — 'Full video on YouTube · Link in bio'" },
    ];
  }

  // Map beats onto evenly-sampled scenes
  const sampled = pickScenes(scenes, Math.min(beats.length, scenes.length));
  let cursor = 0;
  beats.forEach((beat, i) => {
    const scene = sampled[Math.min(i, sampled.length - 1)];
    const start = cursor;
    const end = cursor + beat.secs;
    cursor = end;
    lines.push(`[${start.toString().padStart(2, "0")}s → ${end.toString().padStart(2, "0")}s]  ${beat.label}`);
    if (scene) {
      lines.push(`           ↳ Pull from Scene #${scene.index + 1} "${scene.title}"`);
      lines.push(`           ↳ Shot: ${scene.shotType} · Camera: ${scene.cameraMovement} · Location: ${scene.location}`);
    }
    lines.push("");
  });

  lines.push("▼ EDIT NOTES");
  lines.push("- Cut on the kick. Caption text stays on for ≥1s.");
  lines.push("- First 1.5s must work with sound off (mute autoplay).");
  lines.push("- End card holds 2s minimum so the algorithm registers a complete view.");
  return lines.join("\n");
}

function genTeaser15(ctx: MarketingContext): string {
  return buildTeaserPlan(ctx, 15, "15-Second Teaser");
}
function genTeaser30(ctx: MarketingContext): string {
  return buildTeaserPlan(ctx, 30, "30-Second Teaser");
}
function genTrailer60(ctx: MarketingContext): string {
  return buildTeaserPlan(ctx, 60, "60-Second Trailer");
}

function genThumbnailPrompt(ctx: MarketingContext): string {
  const { project, scenes, brandPreset } = ctx;
  const a = project.artist ?? "Artist";
  const t = project.title;
  const m = project.mood ?? "cinematic";
  const hero = scenes.find((s) => s.shotType?.toLowerCase().includes("close")) ?? scenes[0];
  const palette = brandPreset?.colorPalette ?? hero?.colorPalette ?? project.coverColor ?? "deep crimson, ink black, cold steel";
  const style = brandPreset?.visualStyle ?? project.visualStyle ?? `cinematic ${m} music video poster`;
  return [
    `YouTube thumbnail for "${t}" by ${a}.`,
    "",
    "SUBJECT:",
    hero
      ? `${hero.characterAction || "lead character"}, ${hero.shotType.toLowerCase()}, ${hero.lighting.toLowerCase()}, framed dead-center.`
      : `${a} hero shot, intense direct gaze into camera, framed dead-center.`,
    "",
    "STYLE:",
    style,
    "",
    "COLOR & LIGHT:",
    `${palette}. High contrast. Single dominant light source. Cinematic film grain.`,
    "",
    "TYPOGRAPHY:",
    `Bold uppercase title "${t.toUpperCase()}" lower-third, with smaller "${a.toUpperCase()}" above. Tight tracking. Off-white on black panel or hot color overlay.`,
    "",
    "COMPOSITION RULES:",
    "Rule of thirds, eyes on top third, negative space top-left for YouTube duration badge clearance, 1280×720, no logos in lower-right.",
    "",
    "NEGATIVE PROMPT:",
    brandPreset?.negativePromptRules ??
      "low contrast, blurry, watermark, text artifacts, deformed face, extra fingers, cluttered background, generic stock photo look.",
  ].join("\n");
}

function genCoverArtPrompt(ctx: MarketingContext): string {
  const { project, scenes, brandPreset } = ctx;
  const a = project.artist ?? "Artist";
  const t = project.title;
  const m = project.mood ?? "cinematic";
  const palette = brandPreset?.colorPalette ?? project.coverColor ?? "deep crimson, ink black, cold steel";
  const style = brandPreset?.visualStyle ?? project.visualStyle ?? `${m} music single cover`;
  const symbol = brandPreset?.recurringSymbols?.split(",")[0]?.trim() ?? scenes[0]?.environment ?? "single iconic object";
  return [
    `Square 1:1 single cover artwork for "${t}" by ${a}.`,
    "",
    "CONCEPT:",
    `A single iconic image that captures the core feeling of "${t}". One subject, one symbol, one clear emotion. Reads from a phone-sized 60×60 thumbnail.`,
    "",
    "SUBJECT:",
    `${symbol} as the centerpiece, with ${m} atmosphere. No clutter, no extra characters.`,
    "",
    "STYLE:",
    style,
    "",
    "COLOR & LIGHT:",
    `${palette}. Painterly cinematic grade. Strong rim light. Subtle film grain.`,
    "",
    "TYPOGRAPHY (separate layer, optional):",
    `"${a.toUpperCase()}" small at top, "${t.toUpperCase()}" large at bottom — both in a clean condensed sans, off-white.`,
    "",
    "OUTPUT:",
    "3000×3000 px, sRGB, no watermark, full bleed, suitable for Spotify / Apple Music / Bandcamp upload.",
    "",
    "NEGATIVE PROMPT:",
    brandPreset?.negativePromptRules ??
      "low resolution, watermark, deformed hands, generic stock imagery, AI artifacts, multiple incoherent subjects.",
  ].join("\n");
}

function genBehindTheScenes(ctx: MarketingContext): string {
  const { project, scenes } = ctx;
  const a = project.artist ?? "Us";
  const t = project.title;
  const m = project.mood ?? "this one";
  const sceneCount = scenes.length;
  const locations = topByTally(scenes, (s) => s.location, 3);
  return [
    `▼ BEHIND THE SCENES — "${t}"`,
    "",
    `We didn't have a budget. We had a vision.`,
    "",
    `${sceneCount > 0 ? `${sceneCount} scenes` : "Every frame"}, ${locations.length > 0 ? `shot across ${locations.join(", ")}` : "shot wherever the light was right"}, edited late nights between day jobs.`,
    "",
    `Why "${t}" had to feel ${m}: ${project.brandDirection || "we wanted the visual to land the same gut-punch as the song. Anything less would have been a lie."}`,
    "",
    "Things we figured out the hard way:",
    "• The best take is almost always take 7.",
    "• Color grade fixes 80% of \"this looks amateur\".",
    "• Audio sync is everything — re-cut the picture to the kick, not the snare.",
    "",
    `Out now everywhere you stream music. Watch the full video on YouTube.`,
    "",
    `— ${a}`,
  ].join("\n");
}

function genReleaseAnnouncement(ctx: MarketingContext): string {
  const { project, brandPreset } = ctx;
  const a = project.artist ?? "Artist";
  const t = project.title;
  const g = project.genre ?? "music";
  const m = project.mood ?? "cinematic";
  const watermark = brandPreset?.watermarkText ?? a.toUpperCase();
  return [
    `🚨 OUT NOW 🚨`,
    "",
    `${a} — "${t}"`,
    `${g} · ${m}${project.bpm ? ` · ${Math.round(project.bpm)} BPM` : ""}${project.keySignature ? ` · ${project.keySignature}` : ""}`,
    "",
    `The official music video is live on YouTube. The track is on every streaming platform.`,
    "",
    `If you've been waiting on this — thank you. If you're new here — welcome.`,
    "",
    `Watch · Stream · Save · Share. Every play is fuel for the next one.`,
    "",
    `▶️ YouTube: [link]`,
    `🎵 Spotify · Apple Music · all platforms: [link]`,
    `📱 Follow @${slugify(a)} for the full release week rollout.`,
    "",
    `// ${watermark}`,
  ].join("\n");
}

const GENERATORS: Record<MarketingAssetKind, (ctx: MarketingContext) => string> = {
  youtube_titles: genYouTubeTitles,
  youtube_description: genYouTubeDescription,
  tiktok_caption: genTikTokCaption,
  instagram_caption: genInstagramCaption,
  facebook_caption: genFacebookCaption,
  hashtags: genHashtags,
  teaser_15s: genTeaser15,
  teaser_30s: genTeaser30,
  trailer_60s: genTrailer60,
  thumbnail_prompt: genThumbnailPrompt,
  cover_art_prompt: genCoverArtPrompt,
  behind_the_scenes: genBehindTheScenes,
  release_announcement: genReleaseAnnouncement,
};

export function generateMarketingAsset(
  kind: MarketingAssetKind,
  ctx: MarketingContext,
): string {
  return GENERATORS[kind](ctx);
}

export function generateAllMarketingAssets(
  ctx: MarketingContext,
): Array<{ kind: MarketingAssetKind; content: string }> {
  return MARKETING_ASSET_KINDS.map((kind) => ({
    kind,
    content: GENERATORS[kind](ctx),
  }));
}

// ---------------------------------------------------------------------------
// Export builders
// ---------------------------------------------------------------------------

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Defuse CSV formula injection (Excel/Sheets/Numbers all execute leading
  // =, +, -, @, tab, CR formulas) by prefixing with an apostrophe. Also catch
  // the leading-whitespace bypass (e.g. " =SUM(...)") per OWASP guidance.
  if (/^\s*[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type MarketingExportFormat = "txt" | "csv" | "json";

export function buildMarketingExport(
  format: MarketingExportFormat,
  project: Project,
  assets: Array<{ kind: MarketingAssetKind; content: string; updatedAt?: Date | string }>,
): string {
  if (format === "json") {
    return JSON.stringify(
      {
        project: {
          id: project.id,
          title: project.title,
          artist: project.artist,
          genre: project.genre,
          mood: project.mood,
        },
        generatedAt: new Date().toISOString(),
        assets: assets.map((a) => ({
          kind: a.kind,
          label: MARKETING_KIND_META[a.kind].label,
          content: a.content,
          updatedAt:
            a.updatedAt instanceof Date
              ? a.updatedAt.toISOString()
              : a.updatedAt ?? null,
        })),
      },
      null,
      2,
    );
  }

  if (format === "csv") {
    const lines: string[] = [];
    lines.push(`# Shotgun Ninjas — Marketing Asset Pack`);
    lines.push(`# Project: ${project.title}${project.artist ? ` — ${project.artist}` : ""}`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push(`#`);
    lines.push(["kind", "label", "content"].map(csvCell).join(","));
    for (const a of assets) {
      lines.push(
        [a.kind, MARKETING_KIND_META[a.kind].label, a.content].map(csvCell).join(","),
      );
    }
    return lines.join("\n");
  }

  // txt
  const lines: string[] = [];
  const title = project.artist ? `${project.title} — ${project.artist}` : project.title;
  lines.push(`==============================================================`);
  lines.push(`MARKETING ASSET PACK — ${title}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`==============================================================`);
  lines.push("");
  for (const a of assets) {
    const meta = MARKETING_KIND_META[a.kind];
    lines.push(`──────────────────────────────────────────────────────────────`);
    lines.push(`▼ ${meta.label.toUpperCase()}`);
    lines.push(`(${meta.description})`);
    lines.push(`──────────────────────────────────────────────────────────────`);
    lines.push(a.content);
    lines.push("");
    lines.push("");
  }
  return lines.join("\n");
}

export const MARKETING_FORMAT_META: Record<MarketingExportFormat, { ext: string; mime: string; label: string }> = {
  txt: { ext: "txt", mime: "text/plain", label: "Plain text" },
  csv: { ext: "csv", mime: "text/csv", label: "CSV (spreadsheet)" },
  json: { ext: "json", mime: "application/json", label: "JSON (machine-readable)" },
};
