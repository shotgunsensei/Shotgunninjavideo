import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  audioFilesTable,
  projectsTable,
  analysisTable,
  timelineSegmentsTable,
  activityTable,
} from "@workspace/db";
import { UploadAudioBody } from "@workspace/api-zod";
import { buildMockAnalysis } from "../lib/mockAnalysis";

const router: IRouter = Router();

router.post("/projects/:id/audio", async (req, res) => {
  const id = req.params.id;
  const body = UploadAudioBody.parse(req.body);
  await db.delete(audioFilesTable).where(eq(audioFilesTable.projectId, id));
  const [audio] = await db
    .insert(audioFilesTable)
    .values({
      projectId: id,
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      durationSec: body.durationSec ?? null,
    })
    .returning();
  if (!audio) {
    res.status(500).json({ error: "Insert failed" });
    return;
  }
  await db
    .update(projectsTable)
    .set({
      status: "uploaded",
      durationSec: body.durationSec ?? null,
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, id));
  await db.insert(activityTable).values({
    projectId: id,
    kind: "audio_uploaded",
    message: `Uploaded "${body.fileName}"`,
  });
  res.status(201).json({ ...audio, createdAt: audio.createdAt.toISOString() });
});

router.post("/projects/:id/analyze", async (req, res) => {
  const id = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [audio] = await db.select().from(audioFilesTable).where(eq(audioFilesTable.projectId, id));
  const duration = audio?.durationSec ?? project.durationSec ?? 180;
  const analysis = buildMockAnalysis(id, duration, project.bpm ?? undefined);

  await db.delete(analysisTable).where(eq(analysisTable.projectId, id));
  await db.delete(timelineSegmentsTable).where(eq(timelineSegmentsTable.projectId, id));

  await db.insert(analysisTable).values({
    projectId: id,
    durationSec: duration,
    bpm: analysis.bpm,
    keySignature: analysis.keySignature,
    energy: analysis.energy,
    loudnessDb: analysis.loudnessDb,
    emotionalMap: analysis.emotionalMap,
  });
  const insertedSegs = await db
    .insert(timelineSegmentsTable)
    .values(analysis.segments)
    .returning();

  await db
    .update(projectsTable)
    .set({
      status: "analyzed",
      bpm: analysis.bpm,
      keySignature: analysis.keySignature,
      durationSec: duration,
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, id));

  await db.insert(activityTable).values({
    projectId: id,
    kind: "analyzed",
    message: `Analyzed audio — ${analysis.bpm} BPM, ${analysis.keySignature}`,
  });

  res.json({
    projectId: id,
    durationSec: duration,
    bpm: analysis.bpm,
    keySignature: analysis.keySignature,
    energy: analysis.energy,
    loudnessDb: analysis.loudnessDb,
    segments: insertedSegs,
    emotionalMap: analysis.emotionalMap,
  });
});

router.get("/projects/:id/analysis", async (req, res) => {
  const id = req.params.id;
  const [analysis] = await db.select().from(analysisTable).where(eq(analysisTable.projectId, id));
  if (!analysis) {
    res.status(404).json({ error: "Not analyzed yet" });
    return;
  }
  const segments = await db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.projectId, id))
    .orderBy(timelineSegmentsTable.index);
  res.json({
    projectId: analysis.projectId,
    durationSec: analysis.durationSec,
    bpm: analysis.bpm,
    keySignature: analysis.keySignature,
    energy: analysis.energy,
    loudnessDb: analysis.loudnessDb ?? undefined,
    segments,
    emotionalMap: analysis.emotionalMap as unknown[],
  });
});

router.get("/projects/:id/timeline", async (req, res) => {
  const segments = await db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.projectId, req.params.id))
    .orderBy(timelineSegmentsTable.index);
  res.json(segments);
});

export default router;
