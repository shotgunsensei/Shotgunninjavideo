import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  promptsTable,
  storyboardScenesTable,
  projectsTable,
  activityTable,
  settingsTable,
} from "@workspace/db";
import { UpdatePromptBody } from "@workspace/api-zod";
import { buildPromptText } from "../lib/mockAnalysis";

const router: IRouter = Router();

router.get("/projects/:id/prompts", async (req, res) => {
  const prompts = await db
    .select()
    .from(promptsTable)
    .where(eq(promptsTable.projectId, req.params.id))
    .orderBy(promptsTable.index);
  res.json(prompts);
});

router.post("/projects/:id/prompts", async (req, res) => {
  const id = req.params.id;
  const scenes = await db
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, id))
    .orderBy(storyboardScenesTable.index);
  if (scenes.length === 0) {
    res.status(400).json({ error: "Generate storyboard first" });
    return;
  }
  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  const model = settings?.defaultModel ?? "generic";
  const aspectRatio = settings?.defaultAspectRatio ?? "16:9";
  const durationSec = settings?.defaultSceneDurationSec ?? 6;

  const toInsert = scenes.map((s) => ({
    projectId: id,
    sceneId: s.id,
    index: s.index,
    model,
    text: buildPromptText(s),
    negativePrompt: "low quality, watermark, text, blurry, deformed, cartoon",
    aspectRatio,
    durationSec,
  }));
  // Replace prompts + bump project status atomically so a mid-flight failure
  // can't leave the project with an empty prompts list while still flagged as
  // "prompted".
  const inserted = await db.transaction(async (tx) => {
    await tx.delete(promptsTable).where(eq(promptsTable.projectId, id));
    const rows = await tx.insert(promptsTable).values(toInsert).returning();
    await tx
      .update(projectsTable)
      .set({ status: "prompted", updatedAt: new Date() })
      .where(eq(projectsTable.id, id));
    await tx.insert(activityTable).values({
      projectId: id,
      kind: "prompts_generated",
      message: `Generated ${rows.length} scene prompts`,
    });
    return rows;
  });
  res.status(201).json(inserted);
});

router.patch("/prompts/:promptId", async (req, res) => {
  const body = UpdatePromptBody.parse(req.body);
  const updateData: Record<string, unknown> = {};
  for (const k of ["text", "negativePrompt", "model", "aspectRatio", "durationSec"] as const) {
    if (body[k] !== undefined) updateData[k] = body[k];
  }
  const [updated] = await db
    .update(promptsTable)
    .set(updateData)
    .where(eq(promptsTable.id, req.params.promptId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

export default router;
