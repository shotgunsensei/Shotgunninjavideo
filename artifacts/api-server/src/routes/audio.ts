import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  audioFilesTable,
  projectsTable,
  analysisTable,
  timelineSegmentsTable,
  activityTable,
  type InsertTimelineSegment,
} from "@workspace/db";
import { UploadAudioBody, AnalyzeAudioBody } from "@workspace/api-zod";
import { buildMockAnalysis } from "../lib/mockAnalysis";

const router: IRouter = Router();

// Defense-in-depth allowlist. The actual audio bytes never reach the server
// (they live in IndexedDB on the client), but we still validate the metadata
// to keep poisoned values from showing up in exports or activity logs.
const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
]);
const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB — matches the client cap
const MAX_FILENAME_LEN = 255;

router.post("/projects/:id/audio", async (req, res) => {
  const id = req.params.id;
  const body = UploadAudioBody.parse(req.body);

  // Validate metadata even though the bytes themselves never reach us
  if (!ALLOWED_AUDIO_MIME.has(body.mimeType)) {
    res.status(415).json({
      error: `Unsupported audio mime type: ${body.mimeType}`,
    });
    return;
  }
  if (body.sizeBytes <= 0 || body.sizeBytes > MAX_AUDIO_BYTES) {
    res.status(413).json({
      error: `Audio file size must be between 1 byte and ${MAX_AUDIO_BYTES} bytes.`,
    });
    return;
  }
  if (!body.fileName || body.fileName.length > MAX_FILENAME_LEN) {
    res.status(400).json({
      error: `Filename must be 1–${MAX_FILENAME_LEN} characters.`,
    });
    return;
  }
  // Confirm the project exists before mutating downstream tables
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

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

  // If body provided, use real client-side analysis. Otherwise, fallback to deterministic mock.
  let bpm: number;
  let keySignature: string;
  let energy: number;
  let loudnessDb: number | null;
  let duration: number;
  let emotionalMap: { timeSec: number; valence: number; arousal: number; label: string }[];
  let segmentInputs: Omit<InsertTimelineSegment, "id">[];
  let source: "client" | "mock";

  const hasBody = req.body && Object.keys(req.body).length > 0;
  if (hasBody) {
    const submitted = AnalyzeAudioBody.parse(req.body);
    duration = submitted.durationSec;
    bpm = Math.round(submitted.bpm);
    keySignature = submitted.keySignature ?? "—";
    energy = Math.max(0, Math.min(1, submitted.energy));
    loudnessDb = submitted.loudnessDb ?? null;
    emotionalMap = submitted.emotionalMap;
    segmentInputs = submitted.segments.map((s, i) => ({
      projectId: id,
      index: i,
      startSec: s.startSec,
      endSec: s.endSec,
      section: s.section,
      intensity: Math.max(0, Math.min(1, s.intensity)),
      emotion: s.emotion,
      bpm: s.bpm ?? bpm,
    }));
    source = "client";
  } else {
    duration = audio?.durationSec ?? project.durationSec ?? 180;
    const analysis = buildMockAnalysis(id, duration, project.bpm ?? undefined);
    bpm = analysis.bpm;
    keySignature = analysis.keySignature;
    energy = analysis.energy;
    loudnessDb = analysis.loudnessDb;
    emotionalMap = analysis.emotionalMap;
    segmentInputs = analysis.segments;
    source = "mock";
  }

  await db.delete(timelineSegmentsTable).where(eq(timelineSegmentsTable.projectId, id));
  await db.delete(analysisTable).where(eq(analysisTable.projectId, id));

  await db.insert(analysisTable).values({
    projectId: id,
    durationSec: duration,
    bpm,
    keySignature,
    energy,
    loudnessDb,
    emotionalMap,
  });
  const insertedSegs = await db
    .insert(timelineSegmentsTable)
    .values(segmentInputs)
    .returning();

  await db
    .update(projectsTable)
    .set({
      status: "analyzed",
      bpm,
      keySignature,
      durationSec: duration,
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, id));

  await db.insert(activityTable).values({
    projectId: id,
    kind: "analyzed",
    message:
      source === "client"
        ? `Decoded audio — ${bpm} BPM, ${insertedSegs.length} segments detected`
        : `Mock-analyzed audio — ${bpm} BPM, ${keySignature}`,
  });

  res.json({
    projectId: id,
    durationSec: duration,
    bpm,
    keySignature,
    energy,
    loudnessDb: loudnessDb ?? undefined,
    segments: insertedSegs,
    emotionalMap,
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
