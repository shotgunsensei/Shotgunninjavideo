import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import {
  db,
  timelineSegmentsTable,
  analysisTable,
} from "@workspace/db";
import {
  CreateSegmentBody,
  UpdateSegmentBody,
  SplitSegmentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function reindexAndReturn(projectId: string) {
  const segs = await db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.projectId, projectId))
    .orderBy(asc(timelineSegmentsTable.startSec));

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (s.index !== i) {
      await db
        .update(timelineSegmentsTable)
        .set({ index: i })
        .where(eq(timelineSegmentsTable.id, s.id));
    }
  }

  return db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.projectId, projectId))
    .orderBy(asc(timelineSegmentsTable.index));
}

router.post("/projects/:id/timeline/segments", async (req, res) => {
  const projectId = req.params.id;
  const body = CreateSegmentBody.parse(req.body);
  if (body.endSec <= body.startSec) {
    res.status(400).json({ error: "endSec must be greater than startSec" });
    return;
  }
  await db.insert(timelineSegmentsTable).values({
    projectId,
    index: 0,
    startSec: body.startSec,
    endSec: body.endSec,
    section: body.section ?? "verse",
    intensity: body.intensity ?? 0.5,
    emotion: body.emotion ?? "drive",
  });
  const segs = await reindexAndReturn(projectId);
  res.status(201).json(segs);
});

router.patch("/timeline-segments/:segmentId", async (req, res) => {
  const segmentId = req.params.segmentId;
  const body = UpdateSegmentBody.parse(req.body);
  const [existing] = await db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.id, segmentId));
  if (!existing) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }
  const newStart = body.startSec ?? existing.startSec;
  const newEnd = body.endSec ?? existing.endSec;
  if (newEnd <= newStart) {
    res.status(400).json({ error: "endSec must be greater than startSec" });
    return;
  }
  await db
    .update(timelineSegmentsTable)
    .set({
      startSec: newStart,
      endSec: newEnd,
      section: body.section ?? existing.section,
      intensity:
        body.intensity !== undefined
          ? Math.max(0, Math.min(1, body.intensity))
          : existing.intensity,
      emotion: body.emotion ?? existing.emotion,
    })
    .where(eq(timelineSegmentsTable.id, segmentId));
  const segs = await reindexAndReturn(existing.projectId);
  res.json(segs);
});

router.delete("/timeline-segments/:segmentId", async (req, res) => {
  const segmentId = req.params.segmentId;
  const [existing] = await db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.id, segmentId));
  if (!existing) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }
  await db.delete(timelineSegmentsTable).where(eq(timelineSegmentsTable.id, segmentId));
  const segs = await reindexAndReturn(existing.projectId);
  res.json(segs);
});

router.post("/timeline-segments/:segmentId/split", async (req, res) => {
  const segmentId = req.params.segmentId;
  const body = SplitSegmentBody.parse(req.body ?? {});
  const [existing] = await db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.id, segmentId));
  if (!existing) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }
  const mid =
    body.atSec !== undefined
      ? Math.max(existing.startSec + 0.1, Math.min(existing.endSec - 0.1, body.atSec))
      : (existing.startSec + existing.endSec) / 2;

  await db
    .update(timelineSegmentsTable)
    .set({ endSec: mid })
    .where(eq(timelineSegmentsTable.id, segmentId));

  await db.insert(timelineSegmentsTable).values({
    projectId: existing.projectId,
    index: existing.index + 1,
    startSec: mid,
    endSec: existing.endSec,
    section: existing.section,
    intensity: existing.intensity,
    emotion: existing.emotion,
    bpm: existing.bpm,
  });

  const segs = await reindexAndReturn(existing.projectId);
  res.json(segs);
});

// keep emotionalMap untouched on edits — analysis row stays valid, segments are independent
void analysisTable;

export default router;
