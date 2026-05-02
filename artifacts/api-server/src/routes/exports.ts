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
} from "@workspace/db";
import { CreateExportBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects/:id/exports", async (req, res) => {
  const rows = await db
    .select()
    .from(exportsTable)
    .where(eq(exportsTable.projectId, req.params.id))
    .orderBy(exportsTable.createdAt);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/projects/:id/exports", async (req, res) => {
  const id = req.params.id;
  const body = CreateExportBody.parse(req.body);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const scenes = await db
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, id))
    .orderBy(storyboardScenesTable.index);
  const prompts = await db
    .select()
    .from(promptsTable)
    .where(eq(promptsTable.projectId, id))
    .orderBy(promptsTable.index);
  const segments = await db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.projectId, id))
    .orderBy(timelineSegmentsTable.index);
  const [analysis] = await db.select().from(analysisTable).where(eq(analysisTable.projectId, id));

  let content = "";
  if (body.format === "json") {
    content = JSON.stringify(
      { project, analysis, segments, scenes, prompts },
      null,
      2,
    );
  } else if (body.format === "txt") {
    const lines: string[] = [];
    lines.push(`# ${project.title}`);
    if (project.artist) lines.push(`Artist: ${project.artist}`);
    if (project.genre) lines.push(`Genre: ${project.genre}`);
    lines.push("");
    for (const s of scenes) {
      const p = prompts.find((x) => x.sceneId === s.id);
      lines.push(`--- Scene ${s.index + 1} (${s.startSec.toFixed(1)}s – ${s.endSec.toFixed(1)}s) ---`);
      lines.push(`Title: ${s.title}`);
      lines.push(`Shot: ${s.shotType} | ${s.cameraMovement}`);
      lines.push(`Location: ${s.location}`);
      lines.push(`Lighting: ${s.lighting}`);
      lines.push(`Palette: ${s.colorPalette}`);
      lines.push(`Description: ${s.description}`);
      if (p) lines.push(`Prompt [${p.model}]: ${p.text}`);
      lines.push("");
    }
    content = lines.join("\n");
  } else {
    const lines: string[] = [];
    lines.push(`SHOTGUN NINJAS — PRODUCTION PLAN`);
    lines.push(`================================`);
    lines.push(`Project: ${project.title}`);
    if (project.artist) lines.push(`Artist: ${project.artist}`);
    if (analysis) {
      lines.push(`Duration: ${analysis.durationSec.toFixed(1)}s @ ${analysis.bpm} BPM (${analysis.keySignature})`);
    }
    lines.push(`Scenes: ${scenes.length} | Prompts: ${prompts.length}`);
    lines.push("");
    lines.push("CALL SHEET");
    lines.push("----------");
    const locations = Array.from(new Set(scenes.map((s) => s.location)));
    locations.forEach((loc, i) => lines.push(`Location ${i + 1}: ${loc}`));
    lines.push("");
    lines.push("WARDROBE");
    lines.push("--------");
    const wardrobe = Array.from(new Set(scenes.map((s) => s.wardrobe).filter(Boolean)));
    wardrobe.forEach((w) => lines.push(`- ${w}`));
    lines.push("");
    lines.push("SHOT LIST");
    lines.push("---------");
    scenes.forEach((s) =>
      lines.push(
        `#${s.index + 1} [${s.startSec.toFixed(1)}–${s.endSec.toFixed(1)}s] ${s.shotType} / ${s.cameraMovement} — ${s.title}`,
      ),
    );
    content = lines.join("\n");
  }

  const [created] = await db
    .insert(exportsTable)
    .values({ projectId: id, format: body.format, content })
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
    message: `Exported as ${body.format}`,
  });
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

export default router;
