import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  audioFilesTable,
  storyboardScenesTable,
  promptsTable,
  exportsTable,
  activityTable,
  analysisTable,
  timelineSegmentsTable,
} from "@workspace/db";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";

const router: IRouter = Router();

const COVER_COLORS = ["#FF1B6B", "#7B2CBF", "#E50914", "#9D4EDD", "#FF006E", "#3A0CA3"];

router.get("/projects", async (_req, res) => {
  const projects = await db.select().from(projectsTable).orderBy(desc(projectsTable.updatedAt));
  const ids = projects.map((p) => p.id);
  const sceneCounts = ids.length
    ? await db
        .select({ projectId: storyboardScenesTable.projectId, c: sql<number>`count(*)::int` })
        .from(storyboardScenesTable)
        .groupBy(storyboardScenesTable.projectId)
    : [];
  const promptCounts = ids.length
    ? await db
        .select({ projectId: promptsTable.projectId, c: sql<number>`count(*)::int` })
        .from(promptsTable)
        .groupBy(promptsTable.projectId)
    : [];
  const exportCounts = ids.length
    ? await db
        .select({ projectId: exportsTable.projectId, c: sql<number>`count(*)::int` })
        .from(exportsTable)
        .groupBy(exportsTable.projectId)
    : [];

  const sceneMap = new Map(sceneCounts.map((s) => [s.projectId, s.c]));
  const promptMap = new Map(promptCounts.map((s) => [s.projectId, s.c]));
  const exportMap = new Map(exportCounts.map((s) => [s.projectId, s.c]));

  res.json(
    projects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      sceneCount: sceneMap.get(p.id) ?? 0,
      promptCount: promptMap.get(p.id) ?? 0,
      exportCount: exportMap.get(p.id) ?? 0,
    })),
  );
});

router.post("/projects", async (req, res) => {
  const body = CreateProjectBody.parse(req.body);
  const coverColor = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)] ?? "#FF1B6B";
  const [created] = await db
    .insert(projectsTable)
    .values({
      title: body.title,
      artist: body.artist ?? null,
      genre: body.genre ?? null,
      mood: body.mood ?? null,
      visualDirection: body.visualDirection ?? null,
      status: "draft",
      coverColor,
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "Insert failed" });
    return;
  }
  await db.insert(activityTable).values({
    projectId: created.id,
    kind: "project_created",
    message: `Project "${created.title}" created`,
  });
  res.status(201).json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    sceneCount: 0,
    promptCount: 0,
    exportCount: 0,
  });
});

router.get("/projects/:id", async (req, res) => {
  const id = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [audio] = await db.select().from(audioFilesTable).where(eq(audioFilesTable.projectId, id));
  const [analysis] = await db.select().from(analysisTable).where(eq(analysisTable.projectId, id));
  const segments = analysis
    ? await db
        .select()
        .from(timelineSegmentsTable)
        .where(eq(timelineSegmentsTable.projectId, id))
        .orderBy(timelineSegmentsTable.index)
    : [];
  const [{ c: sceneCount } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, id));
  const [{ c: promptCount } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(promptsTable)
    .where(eq(promptsTable.projectId, id));
  const [{ c: exportCount } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(exportsTable)
    .where(eq(exportsTable.projectId, id));

  res.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    sceneCount,
    promptCount,
    exportCount,
    audio: audio
      ? { ...audio, createdAt: audio.createdAt.toISOString() }
      : undefined,
    analysis: analysis
      ? {
          projectId: analysis.projectId,
          durationSec: analysis.durationSec,
          bpm: analysis.bpm,
          keySignature: analysis.keySignature,
          energy: analysis.energy,
          loudnessDb: analysis.loudnessDb ?? undefined,
          segments,
          emotionalMap: analysis.emotionalMap as unknown[],
        }
      : undefined,
  });
});

router.patch("/projects/:id", async (req, res) => {
  const id = req.params.id;
  const body = UpdateProjectBody.parse(req.body);
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["title", "artist", "genre", "mood", "visualDirection", "status"] as const) {
    if (body[k] !== undefined) updateData[k] = body[k];
  }
  const [updated] = await db
    .update(projectsTable)
    .set(updateData)
    .where(eq(projectsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.delete("/projects/:id", async (req, res) => {
  await db.delete(projectsTable).where(eq(projectsTable.id, req.params.id));
  res.status(204).end();
});

export default router;
