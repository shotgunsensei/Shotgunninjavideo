import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  exportsTable,
  projectsTable,
  storyboardScenesTable,
  promptsTable,
  timelineSegmentsTable,
  analysisTable,
  activityTable,
  lyricLinesTable,
  continuityTable,
  settingsTable,
} from "@workspace/db";
import { CreateExportBody } from "@workspace/api-zod";
import {
  buildExport,
  FORMAT_META,
  type ExportFormat,
} from "../lib/exporters";
import {
  EXPORT_FORMAT_GATE,
  isExportFormatAllowed,
  PLAN_CATALOG,
  requiredPlanForExportFormat,
} from "@workspace/billing";
import { getBillingProvider } from "../lib/billingProvider";

const router: IRouter = Router();

function decorate<
  T extends { format: string; createdAt: Date | string },
>(row: T) {
  const meta = FORMAT_META[row.format as ExportFormat];
  return {
    ...row,
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : row.createdAt.toISOString(),
    mimeType: meta?.mime ?? "text/plain",
    fileExtension: meta?.ext ?? "txt",
  };
}

router.get("/projects/:id/exports", async (req, res) => {
  const id = req.params.id;
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }
  const rows = await db
    .select()
    .from(exportsTable)
    .where(eq(exportsTable.projectId, id))
    .orderBy(exportsTable.createdAt);
  res.json(rows.map(decorate));
});

router.post("/projects/:id/exports", async (req, res) => {
  const id = req.params.id;
  const body = CreateExportBody.parse(req.body);
  const format = body.format as ExportFormat;

  // Plan gate: each export format maps to a Feature in the billing catalog.
  const billing = await getBillingProvider().getCurrent();
  if (!isExportFormatAllowed(billing.plan, format)) {
    const required = requiredPlanForExportFormat(format);
    const requiredFeature = EXPORT_FORMAT_GATE[format];
    res.status(402).json({
      error: "feature_not_available",
      message: `The "${format}" export requires the ${PLAN_CATALOG[required].name} plan or higher.`,
      currentPlan: billing.plan,
      requiredPlan: required,
      requiredFeature,
    });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Pull every piece of data the exporters might need in parallel.
  const [scenes, prompts, segments, analysisRows, lyrics, continuityRows, settingsRows] =
    await Promise.all([
      db
        .select()
        .from(storyboardScenesTable)
        .where(eq(storyboardScenesTable.projectId, id))
        .orderBy(storyboardScenesTable.index),
      db
        .select()
        .from(promptsTable)
        .where(eq(promptsTable.projectId, id))
        .orderBy(promptsTable.index),
      db
        .select()
        .from(timelineSegmentsTable)
        .where(eq(timelineSegmentsTable.projectId, id))
        .orderBy(timelineSegmentsTable.index),
      db.select().from(analysisTable).where(eq(analysisTable.projectId, id)),
      db
        .select()
        .from(lyricLinesTable)
        .where(eq(lyricLinesTable.projectId, id))
        .orderBy(lyricLinesTable.index),
      db
        .select()
        .from(continuityTable)
        .where(eq(continuityTable.projectId, id)),
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

  const [created] = await db
    .insert(exportsTable)
    .values({ projectId: id, format, content })
    .returning();
  if (!created) {
    res.status(500).json({ error: "Insert failed" });
    return;
  }
  await db
    .update(projectsTable)
    .set({ status: "exported", updatedAt: new Date() })
    .where(eq(projectsTable.id, id));
  await db.insert(activityTable).values({
    projectId: id,
    kind: "exported",
    message: `Exported as ${format}`,
  });
  res.status(201).json(decorate(created));
});

export default router;
