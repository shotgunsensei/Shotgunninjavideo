import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  projectsTable,
  storyboardScenesTable,
  settingsTable,
} from "@workspace/db";
import { PLATFORMS, buildScenePromptEngineRow } from "../lib/promptEngine";

const router: IRouter = Router();

router.get("/projects/:id/prompt-engine", async (req, res) => {
  const id = req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const scenes = await db
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, id))
    .orderBy(storyboardScenesTable.index);
  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  const defaultAspectRatio = settings?.defaultAspectRatio ?? "16:9";
  const defaultDurationSec = settings?.defaultSceneDurationSec ?? 6;

  const rows = scenes.map((scene) =>
    buildScenePromptEngineRow({
      scene,
      project,
      defaultAspectRatio,
      defaultDurationSec,
    }),
  );

  res.json({
    scenes: rows,
    platforms: PLATFORMS,
  });
});

export default router;
