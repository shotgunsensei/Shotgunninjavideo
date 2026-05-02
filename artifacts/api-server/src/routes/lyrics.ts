import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  lyricLinesTable,
  projectsTable,
  storyboardScenesTable,
  type LyricLine,
} from "@workspace/db";
import {
  ParseLyricsBody,
  SaveLyricsBody,
  UpdateLyricLineBody,
} from "@workspace/api-zod";
import { parseLyrics, lyricsForScene } from "../lib/lyricsParser";

const router: IRouter = Router();

router.get("/projects/:id/lyrics", async (req, res) => {
  const id = req.params.id;
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }
  const lines = await db
    .select()
    .from(lyricLinesTable)
    .where(eq(lyricLinesTable.projectId, id))
    .orderBy(lyricLinesTable.index);
  res.json(lines);
});

router.post("/projects/:id/lyrics/parse", async (req, res) => {
  const body = ParseLyricsBody.parse(req.body ?? {});
  const parsed = parseLyrics(body.raw ?? "");
  res.json({
    hasTimestamps: parsed.some((l) => l.timestampSec !== null),
    lines: parsed.map((l) => ({
      index: l.index,
      text: l.text,
      timestampSec: l.timestampSec,
    })),
  });
});

router.put("/projects/:id/lyrics", async (req, res) => {
  const id = req.params.id;
  const body = SaveLyricsBody.parse(req.body ?? {});

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const saved = await db.transaction(async (tx) => {
    await tx.delete(lyricLinesTable).where(eq(lyricLinesTable.projectId, id));
    if (body.lines.length === 0) return [] as LyricLine[];
    const rows = body.lines.map((l, i) => ({
      projectId: id,
      index: i,
      text: l.text,
      timestampSec: l.timestampSec ?? null,
      sceneId: l.sceneId ?? null,
    }));
    return tx.insert(lyricLinesTable).values(rows).returning();
  });

  // Mirror the joined raw text on the project row so the storyboard generator
  // continues to work even if no lyric_lines were saved (back-compat).
  const joined = body.lines.map((l) => l.text).join("\n");
  await db
    .update(projectsTable)
    .set({ lyrics: joined.length > 0 ? joined : null, updatedAt: new Date() })
    .where(eq(projectsTable.id, id));

  res.status(200).json(saved);
});

router.patch("/lyric-lines/:lineId", async (req, res) => {
  const body = UpdateLyricLineBody.parse(req.body ?? {});
  const update: Record<string, unknown> = {};
  if (body.text !== undefined) update.text = body.text;
  if (body.timestampSec !== undefined) update.timestampSec = body.timestampSec;
  if (body.sceneId !== undefined) update.sceneId = body.sceneId;

  const [updated] = await db
    .update(lyricLinesTable)
    .set(update)
    .where(eq(lyricLinesTable.id, req.params.lineId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/lyric-lines/:lineId", async (req, res) => {
  const [scene] = await db
    .select()
    .from(lyricLinesTable)
    .where(eq(lyricLinesTable.id, req.params.lineId));
  if (!scene) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.delete(lyricLinesTable).where(eq(lyricLinesTable.id, req.params.lineId));
  const remaining = await db
    .select()
    .from(lyricLinesTable)
    .where(eq(lyricLinesTable.projectId, scene.projectId))
    .orderBy(lyricLinesTable.index);
  res.json(remaining);
});

/**
 * Auto-assign each currently-unassigned, untimestamped lyric line to a scene
 * by distributing them evenly across the existing storyboard.
 * Timestamped lines are left alone (they already match by time-range).
 */
router.post("/projects/:id/lyrics/auto-assign", async (req, res) => {
  const id = req.params.id;
  const lines = await db
    .select()
    .from(lyricLinesTable)
    .where(eq(lyricLinesTable.projectId, id))
    .orderBy(lyricLinesTable.index);
  const scenes = await db
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, id))
    .orderBy(storyboardScenesTable.index);
  if (scenes.length === 0) {
    res.status(400).json({ error: "Generate a storyboard before auto-assigning lyrics." });
    return;
  }

  const untimedNoScene = lines.filter(
    (l) => (l.timestampSec === null || l.timestampSec === undefined) && !l.sceneId,
  );

  for (let i = 0; i < untimedNoScene.length; i++) {
    const line = untimedNoScene[i]!;
    const sceneIdx = Math.min(
      scenes.length - 1,
      Math.floor((i / Math.max(1, untimedNoScene.length)) * scenes.length),
    );
    const scene = scenes[sceneIdx]!;
    await db
      .update(lyricLinesTable)
      .set({ sceneId: scene.id })
      .where(eq(lyricLinesTable.id, line.id));
  }

  const refreshed = await db
    .select()
    .from(lyricLinesTable)
    .where(eq(lyricLinesTable.projectId, id))
    .orderBy(lyricLinesTable.index);
  res.json(refreshed);
});

/**
 * Helper exported for the storyboard generator: returns a Map<sceneId, string[]>
 * of lyric snippets that should influence each scene at generation time.
 */
export async function getLyricsBySceneId(
  projectId: string,
  scenes: { id: string; startSec: number; endSec: number }[],
): Promise<Map<string, string[]>> {
  const lines = await db
    .select()
    .from(lyricLinesTable)
    .where(eq(lyricLinesTable.projectId, projectId))
    .orderBy(lyricLinesTable.index);
  const out = new Map<string, string[]>();
  for (const s of scenes) {
    out.set(
      s.id,
      lyricsForScene(lines, s).map((l) => l.text),
    );
  }
  return out;
}

export default router;
