import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  storyboardScenesTable,
  timelineSegmentsTable,
  projectsTable,
  activityTable,
} from "@workspace/db";
import { UpdateSceneBody } from "@workspace/api-zod";
import { buildStoryboardScene } from "../lib/mockAnalysis";

const router: IRouter = Router();

router.get("/projects/:id/storyboard", async (req, res) => {
  const scenes = await db
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, req.params.id))
    .orderBy(storyboardScenesTable.index);
  res.json(scenes);
});

router.post("/projects/:id/storyboard", async (req, res) => {
  const id = req.params.id;
  const segments = await db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.projectId, id))
    .orderBy(timelineSegmentsTable.index);
  if (segments.length === 0) {
    res.status(400).json({ error: "Run analysis first" });
    return;
  }
  await db.delete(storyboardScenesTable).where(eq(storyboardScenesTable.projectId, id));
  const toInsert = segments.map((s) => buildStoryboardScene(id, s, id));
  const inserted = await db.insert(storyboardScenesTable).values(toInsert).returning();
  await db
    .update(projectsTable)
    .set({ status: "storyboarded", updatedAt: new Date() })
    .where(eq(projectsTable.id, id));
  await db.insert(activityTable).values({
    projectId: id,
    kind: "storyboard_generated",
    message: `Generated ${inserted.length} storyboard scenes`,
  });
  res.status(201).json(inserted);
});

router.patch("/storyboard/:sceneId", async (req, res) => {
  const body = UpdateSceneBody.parse(req.body);
  const updateData: Record<string, unknown> = {};
  for (const k of [
    "title",
    "description",
    "shotType",
    "cameraMovement",
    "location",
    "lighting",
    "colorPalette",
    "wardrobe",
    "notes",
  ] as const) {
    if (body[k] !== undefined) updateData[k] = body[k];
  }
  const [updated] = await db
    .update(storyboardScenesTable)
    .set(updateData)
    .where(eq(storyboardScenesTable.id, req.params.sceneId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

export default router;
