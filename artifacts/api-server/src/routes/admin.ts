import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  projectsTable,
  audioFilesTable,
  analysisTable,
  timelineSegmentsTable,
  storyboardScenesTable,
  promptsTable,
  exportsTable,
  lyricLinesTable,
  brandPresetsTable,
  marketingAssetsTable,
  continuityTable,
  settingsTable,
  type Project,
  type StoryboardScene,
} from "@workspace/db";
import {
  EXPORT_FORMATS,
  FORMAT_META,
  buildExport,
  type ExportFormat,
} from "../lib/exporters";
import {
  PLAN_CATALOG,
  PLAN_ORDER,
  EXPORT_FORMAT_GATE,
  isExportFormatAllowed,
  isWithinProjectLimit,
  requiredPlanForExportFormat,
  type PlanId,
} from "@workspace/billing";
import { getBillingProvider } from "../lib/billingProvider";
import { seedIfEmpty } from "../lib/seed";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Quality score & validation
// ---------------------------------------------------------------------------

interface QualityCriterion {
  key: string;
  label: string;
  weight: number;
  passed: boolean;
  detail: string;
}

interface ProjectDiagnostic {
  project: Project;
  qualityScore: number;
  qualityGrade: "A" | "B" | "C" | "D" | "F";
  criteria: QualityCriterion[];
  validation: {
    missingFields: string[];
    brokenTimestamps: { sceneIndex: number; sceneId: string; reason: string }[];
    lockedScenes: { index: number; id: string; title: string }[];
    issuesCount: number;
  };
  counts: {
    audioFiles: number;
    timelineSegments: number;
    scenes: number;
    prompts: number;
    lyrics: number;
    exports: number;
    marketingAssets: number;
  };
  hasBrandPreset: boolean;
  hasAnalysis: boolean;
}

// 7 criteria summing to 100 — keep in sync with the public `qualityScore` doc.
const CRITERIA_WEIGHTS = {
  audio: 15,
  timeline: 15,
  storyboard: 20,
  prompts: 15,
  lyricsOrTheme: 10,
  brandPreset: 10,
  exports: 15,
} as const;

function gradeFor(score: number): ProjectDiagnostic["qualityGrade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "F";
}

function checkBrokenTimestamps(scenes: StoryboardScene[]): ProjectDiagnostic["validation"]["brokenTimestamps"] {
  const issues: ProjectDiagnostic["validation"]["brokenTimestamps"] = [];
  const ordered = [...scenes].sort((a, b) => a.index - b.index);
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i]!;
    if (s.startSec < 0) {
      issues.push({ sceneIndex: s.index, sceneId: s.id, reason: `startSec is negative (${s.startSec})` });
    }
    if (s.endSec <= s.startSec) {
      issues.push({
        sceneIndex: s.index,
        sceneId: s.id,
        reason: `endSec (${s.endSec.toFixed(2)}) ≤ startSec (${s.startSec.toFixed(2)})`,
      });
    }
    if (i > 0) {
      const prev = ordered[i - 1]!;
      // 50ms tolerance so float jitter in real edits doesn't trip the check.
      if (s.startSec + 0.05 < prev.endSec) {
        issues.push({
          sceneIndex: s.index,
          sceneId: s.id,
          reason: `Overlaps previous scene (starts at ${s.startSec.toFixed(2)}s but previous ends at ${prev.endSec.toFixed(2)}s)`,
        });
      } else if (s.startSec - prev.endSec > 1.0) {
        issues.push({
          sceneIndex: s.index,
          sceneId: s.id,
          reason: `Gap of ${(s.startSec - prev.endSec).toFixed(2)}s after previous scene`,
        });
      }
    }
  }
  return issues;
}

function checkMissingFields(p: Project): string[] {
  const missing: string[] = [];
  if (!p.title || p.title.trim().length === 0) missing.push("title");
  if (!p.artist || p.artist.trim().length === 0) missing.push("artist");
  if (!p.genre || p.genre.trim().length === 0) missing.push("genre");
  if (!p.mood || p.mood.trim().length === 0) missing.push("mood");
  if (!p.bpm || p.bpm <= 0) missing.push("bpm");
  if (!p.durationSec || p.durationSec <= 0) missing.push("durationSec");
  if (!p.visualStyle || p.visualStyle.trim().length === 0) missing.push("visualStyle");
  return missing;
}

async function buildDiagnostic(project: Project): Promise<ProjectDiagnostic> {
  const id = project.id;
  const [audio, segments, scenes, prompts, lyrics, exports, marketing, analysisRows] =
    await Promise.all([
      db.select().from(audioFilesTable).where(eq(audioFilesTable.projectId, id)),
      db.select().from(timelineSegmentsTable).where(eq(timelineSegmentsTable.projectId, id)),
      db.select().from(storyboardScenesTable).where(eq(storyboardScenesTable.projectId, id)).orderBy(storyboardScenesTable.index),
      db.select().from(promptsTable).where(eq(promptsTable.projectId, id)),
      db.select().from(lyricLinesTable).where(eq(lyricLinesTable.projectId, id)),
      db.select().from(exportsTable).where(eq(exportsTable.projectId, id)),
      db.select().from(marketingAssetsTable).where(eq(marketingAssetsTable.projectId, id)),
      db.select().from(analysisTable).where(eq(analysisTable.projectId, id)),
    ]);

  const counts = {
    audioFiles: audio.length,
    timelineSegments: segments.length,
    scenes: scenes.length,
    prompts: prompts.length,
    lyrics: lyrics.length,
    exports: exports.length,
    marketingAssets: marketing.length,
  };

  const hasLyricsOrTheme =
    lyrics.length > 0 ||
    !!(project.lyrics && project.lyrics.trim().length > 0) ||
    !!(project.brandDirection && project.brandDirection.trim().length > 0) ||
    !!(project.visualDirection && project.visualDirection.trim().length > 0);

  const hasBrandPreset =
    !!project.brandPresetId && project.brandPresetId.trim().length > 0;

  const criteria: QualityCriterion[] = [
    {
      key: "audio",
      label: "Has audio",
      weight: CRITERIA_WEIGHTS.audio,
      passed: counts.audioFiles > 0,
      detail: counts.audioFiles > 0 ? `${counts.audioFiles} audio file(s) uploaded` : "No audio uploaded",
    },
    {
      key: "timeline",
      label: "Has timeline",
      weight: CRITERIA_WEIGHTS.timeline,
      passed: counts.timelineSegments > 0,
      detail: counts.timelineSegments > 0 ? `${counts.timelineSegments} timeline segments` : "Run audio analysis",
    },
    {
      key: "storyboard",
      label: "Has storyboard",
      weight: CRITERIA_WEIGHTS.storyboard,
      passed: counts.scenes > 0,
      detail: counts.scenes > 0 ? `${counts.scenes} scenes` : "Generate storyboard",
    },
    {
      key: "prompts",
      label: "Has prompts",
      weight: CRITERIA_WEIGHTS.prompts,
      passed: counts.prompts > 0,
      detail: counts.prompts > 0 ? `${counts.prompts} prompts` : "Open Prompt Engine",
    },
    {
      key: "lyricsOrTheme",
      label: "Has lyrics or theme",
      weight: CRITERIA_WEIGHTS.lyricsOrTheme,
      passed: hasLyricsOrTheme,
      detail: hasLyricsOrTheme
        ? counts.lyrics > 0
          ? `${counts.lyrics} lyric lines`
          : "Project has theme / brand direction"
        : "No lyrics or theme set",
    },
    {
      key: "brandPreset",
      label: "Has brand preset",
      weight: CRITERIA_WEIGHTS.brandPreset,
      passed: hasBrandPreset,
      detail: hasBrandPreset ? "Brand preset linked" : "No brand preset applied",
    },
    {
      key: "exports",
      label: "Has exports generated",
      weight: CRITERIA_WEIGHTS.exports,
      passed: counts.exports > 0,
      detail: counts.exports > 0 ? `${counts.exports} export(s) generated` : "No exports yet",
    },
  ];

  const qualityScore = criteria.reduce((acc, c) => acc + (c.passed ? c.weight : 0), 0);

  const missingFields = checkMissingFields(project);
  const brokenTimestamps = checkBrokenTimestamps(scenes);
  const lockedScenes = scenes
    .filter((s) => s.locked)
    .map((s) => ({ index: s.index, id: s.id, title: s.title }));

  return {
    project,
    qualityScore,
    qualityGrade: gradeFor(qualityScore),
    criteria,
    validation: {
      missingFields,
      brokenTimestamps,
      lockedScenes,
      issuesCount: missingFields.length + brokenTimestamps.length,
    },
    counts,
    hasBrandPreset,
    hasAnalysis: analysisRows.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/admin/diagnostics — overview of all projects + subscription state
router.get("/admin/diagnostics", async (_req, res) => {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  const diagnostics = await Promise.all(projects.map((p) => buildDiagnostic(p)));

  const billing = await getBillingProvider().getCurrent();
  const plan = billing.plan as PlanId;
  const planMeta = PLAN_CATALOG[plan];
  const projectLimit = planMeta.projectLimit;
  const projectCount = projects.length;

  // Per-format gate state for the current plan
  const exportGate = EXPORT_FORMATS.map((format) => ({
    format,
    label: FORMAT_META[format].label,
    allowed: isExportFormatAllowed(plan, format),
    requiredPlan: requiredPlanForExportFormat(format),
    requiredFeature: EXPORT_FORMAT_GATE[format] ?? null,
  }));

  res.json({
    summary: {
      totalProjects: projectCount,
      avgQualityScore:
        diagnostics.length === 0
          ? 0
          : Math.round(diagnostics.reduce((a, d) => a + d.qualityScore, 0) / diagnostics.length),
      // "Ready to produce" requires BOTH a high quality score AND zero validation issues.
      // A project with broken timestamps or missing required fields is not ready.
      readyToProduce: diagnostics.filter(
        (d) => d.qualityScore >= 75 && d.validation.issuesCount === 0,
      ).length,
      withIssues: diagnostics.filter((d) => d.validation.issuesCount > 0).length,
    },
    subscription: {
      currentPlan: plan,
      planName: planMeta.name,
      planOrder: PLAN_ORDER[plan],
      status: billing.status,
      projectLimit,
      projectCount,
      withinProjectLimit: isWithinProjectLimit(plan, projectCount),
      exportGate,
    },
    projects: diagnostics,
  });
});

// GET /api/admin/projects/:id/full — full JSON dump of every related row
router.get("/admin/projects/:id/full", async (req, res) => {
  const id = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [audio, analysisRows, segments, scenes, prompts, lyrics, exportRows, marketing, continuityRows, brandPreset] =
    await Promise.all([
      db.select().from(audioFilesTable).where(eq(audioFilesTable.projectId, id)),
      db.select().from(analysisTable).where(eq(analysisTable.projectId, id)),
      db.select().from(timelineSegmentsTable).where(eq(timelineSegmentsTable.projectId, id)).orderBy(timelineSegmentsTable.index),
      db.select().from(storyboardScenesTable).where(eq(storyboardScenesTable.projectId, id)).orderBy(storyboardScenesTable.index),
      db.select().from(promptsTable).where(eq(promptsTable.projectId, id)).orderBy(promptsTable.index),
      db.select().from(lyricLinesTable).where(eq(lyricLinesTable.projectId, id)).orderBy(lyricLinesTable.index),
      db.select().from(exportsTable).where(eq(exportsTable.projectId, id)).orderBy(exportsTable.createdAt),
      db.select().from(marketingAssetsTable).where(eq(marketingAssetsTable.projectId, id)),
      db.select().from(continuityTable).where(eq(continuityTable.projectId, id)),
      project.brandPresetId
        ? db.select().from(brandPresetsTable).where(eq(brandPresetsTable.id, project.brandPresetId))
        : Promise.resolve([]),
    ]);

  // Strip large payloads from exports list (preview only)
  const exportSummaries = exportRows.map((e) => ({
    id: e.id,
    format: e.format,
    sizeBytes: e.content.length,
    createdAt: e.createdAt,
    preview: e.content.slice(0, 500),
  }));

  res.json({
    project,
    audio,
    analysis: analysisRows[0] ?? null,
    timelineSegments: segments,
    storyboardScenes: scenes,
    prompts,
    lyrics,
    exports: exportSummaries,
    marketingAssets: marketing,
    continuity: continuityRows[0] ?? null,
    brandPreset: brandPreset[0] ?? null,
  });
});

// POST /api/admin/projects/:id/test-export/:format — runs the builder
// without writing to the DB. Returns size + 800-char preview, or the error.
router.post("/admin/projects/:id/test-export/:format", async (req, res) => {
  const id = req.params.id;
  const formatRaw = req.params.format;
  if (!(EXPORT_FORMATS as readonly string[]).includes(formatRaw)) {
    res.status(400).json({ error: "Invalid format", allowed: EXPORT_FORMATS });
    return;
  }
  const format = formatRaw as ExportFormat;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const [scenes, prompts, segments, analysisRows, lyrics, continuityRows, settingsRows] =
      await Promise.all([
        db.select().from(storyboardScenesTable).where(eq(storyboardScenesTable.projectId, id)).orderBy(storyboardScenesTable.index),
        db.select().from(promptsTable).where(eq(promptsTable.projectId, id)).orderBy(promptsTable.index),
        db.select().from(timelineSegmentsTable).where(eq(timelineSegmentsTable.projectId, id)).orderBy(timelineSegmentsTable.index),
        db.select().from(analysisTable).where(eq(analysisTable.projectId, id)),
        db.select().from(lyricLinesTable).where(eq(lyricLinesTable.projectId, id)).orderBy(lyricLinesTable.index),
        db.select().from(continuityTable).where(eq(continuityTable.projectId, id)),
        db.select().from(settingsTable).where(eq(settingsTable.id, 1)),
      ]);

    const settings = settingsRows[0];
    const content = buildExport(format, {
      project,
      scenes,
      prompts,
      segments,
      analysis: analysisRows[0],
      lyrics,
      continuity: continuityRows[0],
      defaultAspectRatio: settings?.defaultAspectRatio ?? "16:9",
      defaultDurationSec: settings?.defaultSceneDurationSec ?? 6,
    });

    res.json({
      ok: true,
      format,
      sizeBytes: content.length,
      mime: FORMAT_META[format].mime,
      ext: FORMAT_META[format].ext,
      preview: content.slice(0, 800),
    });
  } catch (err) {
    req.log.error({ err, projectId: id, format }, "test-export failed");
    res.json({
      ok: false,
      format,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// POST /api/admin/reset-demo-data — wipes the seeded demo projects and
// re-runs the idempotent seeder. Cascade FKs clean up every related row.
//
// We match on the (title, artist) tuple — NOT title alone — so a custom
// project that happens to share a demo title (with a different artist)
// is never deleted by this endpoint.
const DEMO_FINGERPRINTS: { title: string; artist: string }[] = [
  { title: "Black Velvet Static", artist: "RONIN/X" },
  { title: "Shotgun Ninjas Rise", artist: "Shotgun Ninjas" },
];

router.post("/admin/reset-demo-data", async (_req, res) => {
  const allProjects = await db
    .select({ id: projectsTable.id, title: projectsTable.title, artist: projectsTable.artist })
    .from(projectsTable);

  const demoIds = allProjects
    .filter((p) =>
      DEMO_FINGERPRINTS.some((fp) => fp.title === p.title && fp.artist === p.artist),
    )
    .map((p) => p.id);

  if (demoIds.length > 0) {
    await db.delete(projectsTable).where(inArray(projectsTable.id, demoIds));
  }

  await seedIfEmpty();

  const after = await db
    .select({ id: projectsTable.id, title: projectsTable.title, artist: projectsTable.artist })
    .from(projectsTable);
  const reseeded = after.filter((p) =>
    DEMO_FINGERPRINTS.some((fp) => fp.title === p.title && fp.artist === p.artist),
  );

  res.json({
    ok: true,
    deletedProjects: demoIds.length,
    seededTitles: reseeded.map((p) => p.title),
    matchedBy: "title+artist tuple (custom projects with matching titles are never deleted)",
  });
});

export default router;
