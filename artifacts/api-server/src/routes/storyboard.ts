import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import {
  db,
  storyboardScenesTable,
  timelineSegmentsTable,
  projectsTable,
  activityTable,
  lyricLinesTable,
  type StoryboardScene,
  type InsertStoryboardScene,
} from "@workspace/db";
import {
  UpdateSceneBody,
  GenerateStoryboardBody,
  AddSceneBody,
} from "@workspace/api-zod";
import {
  generateScene,
  VISUAL_STYLES,
  type VisualStyleId,
} from "../lib/sceneGenerator";
import { getLyricsBySceneId } from "./lyrics";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

const router: IRouter = Router();

function resolveStyle(input?: string | null): VisualStyleId {
  if (input && input in VISUAL_STYLES) return input as VisualStyleId;
  return "custom";
}

async function loadProjectScenes(
  exec: DbOrTx,
  projectId: string,
): Promise<StoryboardScene[]> {
  return exec
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, projectId))
    .orderBy(storyboardScenesTable.index);
}

async function reindexProject(
  exec: DbOrTx,
  projectId: string,
): Promise<StoryboardScene[]> {
  const scenes = await loadProjectScenes(exec, projectId);
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i]!;
    if (s.index !== i) {
      await exec
        .update(storyboardScenesTable)
        .set({ index: i })
        .where(eq(storyboardScenesTable.id, s.id));
    }
  }
  return loadProjectScenes(exec, projectId);
}

router.get("/projects/:id/storyboard", async (req, res) => {
  const scenes = await loadProjectScenes(db, req.params.id);
  res.json(scenes);
});

router.post("/projects/:id/storyboard", async (req, res) => {
  const id = req.params.id;
  const body = GenerateStoryboardBody.parse(req.body ?? {});

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const segments = await db
    .select()
    .from(timelineSegmentsTable)
    .where(eq(timelineSegmentsTable.projectId, id))
    .orderBy(timelineSegmentsTable.index);
  if (segments.length === 0) {
    res.status(400).json({ error: "Run analysis first" });
    return;
  }

  const visualStyle = resolveStyle(body.visualStyle ?? project.visualStyle);
  const brandDirection =
    body.brandDirection !== undefined ? body.brandDirection : project.brandDirection;
  const lyrics = body.lyrics !== undefined ? body.lyrics : project.lyrics;
  const force = body.force === true;

  const inserted = await db.transaction(async (tx) => {
    await tx
      .update(projectsTable)
      .set({
        visualStyle,
        brandDirection: brandDirection ?? null,
        lyrics: lyrics ?? null,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, id));

    const existing = await loadProjectScenes(tx, id);

    // Pre-compute lyric matches per segment. Two sources:
    //   1. lines with timestamps that fall inside the segment's time window
    //   2. lines manually assigned (via sceneId) to an existing scene that
    //      currently maps to this segment — preserves the assignment intent
    //      even though the scene id will change after regen.
    const lyricLinesAll = await tx
      .select()
      .from(lyricLinesTable)
      .where(eq(lyricLinesTable.projectId, id))
      .orderBy(lyricLinesTable.index);

    // Map of segmentId -> set of (current) sceneIds belonging to that segment.
    const sceneIdsBySegment = new Map<string, Set<string>>();
    // Map of sceneId -> segmentId, for remapping lyric_lines.sceneId after delete+insert.
    const segmentBySceneId = new Map<string, string>();
    for (const s of existing) {
      if (!s.segmentId) continue;
      segmentBySceneId.set(s.id, s.segmentId);
      const set = sceneIdsBySegment.get(s.segmentId) ?? new Set<string>();
      set.add(s.id);
      sceneIdsBySegment.set(s.segmentId, set);
    }

    const lyricsForSegment = (seg: { id: string; startSec: number; endSec: number }): string[] => {
      const ownSceneIds = sceneIdsBySegment.get(seg.id) ?? new Set<string>();
      return lyricLinesAll
        .filter((l) => {
          // Manual assignment wins
          if (l.sceneId) return ownSceneIds.has(l.sceneId);
          if (l.timestampSec === null || l.timestampSec === undefined) return false;
          return l.timestampSec >= seg.startSec && l.timestampSec < seg.endSec;
        })
        .map((l) => l.text);
    };

    // Remap lyric_lines.sceneId from old scene ids to the equivalent new scene
    // for the same segmentId, so manual assignments survive regeneration.
    const remapLyricSceneIds = async (newScenes: StoryboardScene[]) => {
      const newSceneBySegment = new Map<string, string>();
      for (const ns of newScenes) {
        if (ns.segmentId) newSceneBySegment.set(ns.segmentId, ns.id);
      }
      for (const line of lyricLinesAll) {
        if (!line.sceneId) continue;
        const segId = segmentBySceneId.get(line.sceneId);
        if (!segId) {
          // assigned scene was floating (no segment) and got deleted — null it out
          await tx
            .update(lyricLinesTable)
            .set({ sceneId: null })
            .where(eq(lyricLinesTable.id, line.id));
          continue;
        }
        const newSceneId = newSceneBySegment.get(segId);
        if (newSceneId && newSceneId !== line.sceneId) {
          await tx
            .update(lyricLinesTable)
            .set({ sceneId: newSceneId })
            .where(eq(lyricLinesTable.id, line.id));
        }
      }
    };

    if (force) {
      // Force: blow everything away and rebuild from segments only.
      await tx.delete(storyboardScenesTable).where(eq(storyboardScenesTable.projectId, id));
      const fresh = segments.map((seg) =>
        generateScene({
          projectId: id,
          segment: seg,
          totalSegments: segments.length,
          songTitle: project.title,
          artistName: project.artist,
          visualStyle,
          brandDirection: brandDirection ?? null,
          lyrics: lyrics ?? null,
          lyricLinesInScene: lyricsForSegment(seg),
          seed: id,
        }),
      );
      const inserted = await tx.insert(storyboardScenesTable).values(fresh).returning();
      await remapLyricSceneIds(inserted);
      return inserted;
    }

    // Non-force: preserve every locked scene (including manually-added ones with null segmentId).
    // Keep only the FIRST locked scene per segmentId; treat subsequent duplicates as non-segment locks
    // (i.e. preserve them but they no longer claim a segment).
    const lockedBySegment = new Map<string, StoryboardScene>();
    const lockedFloating: StoryboardScene[] = [];
    for (const s of existing) {
      if (!s.locked) continue;
      if (s.segmentId && !lockedBySegment.has(s.segmentId)) {
        lockedBySegment.set(s.segmentId, s);
      } else {
        // floating: no segment, OR another locked already claims this segment
        lockedFloating.push({ ...s, segmentId: null });
      }
    }

    // Delete only unlocked scenes; locked scenes stay untouched (preserves prompts FK chain).
    const toDelete = existing.filter((s) => !s.locked).map((s) => s.id);
    for (const sceneId of toDelete) {
      await tx.delete(storyboardScenesTable).where(eq(storyboardScenesTable.id, sceneId));
    }

    // For floating scenes that were re-marked (lost their segmentId), persist that change.
    for (const f of lockedFloating) {
      if (existing.find((s) => s.id === f.id)?.segmentId !== null) {
        await tx
          .update(storyboardScenesTable)
          .set({ segmentId: null })
          .where(eq(storyboardScenesTable.id, f.id));
      }
    }

    // Generate new scenes for any segment without a locked scene already attached.
    const toInsert: Omit<InsertStoryboardScene, "id">[] = [];
    for (const seg of segments) {
      if (lockedBySegment.has(seg.id)) continue;
      toInsert.push(
        generateScene({
          projectId: id,
          segment: seg,
          totalSegments: segments.length,
          songTitle: project.title,
          artistName: project.artist,
          visualStyle,
          brandDirection: brandDirection ?? null,
          lyrics: lyrics ?? null,
          lyricLinesInScene: lyricsForSegment(seg),
          seed: id,
        }),
      );
    }

    if (toInsert.length > 0) {
      await tx.insert(storyboardScenesTable).values(toInsert);
    }

    // Remap any manual lyric sceneId assignments that pointed at unlocked
    // scenes we just deleted — find the new scene with the same segmentId.
    const allAfterInsert = await loadProjectScenes(tx, id);
    await remapLyricSceneIds(allAfterInsert);

    // Re-sort all scenes by startSec then existing index, and re-number.
    const all = await loadProjectScenes(tx, id);
    const ordered = [...all].sort((a, b) => a.startSec - b.startSec || a.index - b.index);
    for (let i = 0; i < ordered.length; i++) {
      const s = ordered[i]!;
      if (s.index !== i) {
        await tx
          .update(storyboardScenesTable)
          .set({ index: i })
          .where(eq(storyboardScenesTable.id, s.id));
      }
    }

    return loadProjectScenes(tx, id);
  });

  await db
    .update(projectsTable)
    .set({ status: "storyboarded", updatedAt: new Date() })
    .where(eq(projectsTable.id, id));
  await db.insert(activityTable).values({
    projectId: id,
    kind: "storyboard_generated",
    message: `Generated ${inserted.length} storyboard scenes (${VISUAL_STYLES[visualStyle].label})`,
  });

  res.status(201).json(inserted);
});

router.post("/projects/:id/storyboard/scenes", async (req, res) => {
  const id = req.params.id;
  const body = AddSceneBody.parse(req.body ?? {});

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const scenes = await loadProjectScenes(tx, id);
    const insertIndex =
      body.afterIndex !== undefined && body.afterIndex !== null
        ? Math.max(0, Math.min(scenes.length, body.afterIndex + 1))
        : scenes.length;

    for (const s of scenes) {
      if (s.index >= insertIndex) {
        await tx
          .update(storyboardScenesTable)
          .set({ index: s.index + 1 })
          .where(eq(storyboardScenesTable.id, s.id));
      }
    }

    const prev = scenes[insertIndex - 1];
    const next = scenes[insertIndex];
    const startSec = prev?.endSec ?? 0;
    const endSec =
      next?.startSec ??
      (project.durationSec ? Math.min(project.durationSec, startSec + 10) : startSec + 10);

    const visualStyle = resolveStyle(project.visualStyle);
    const newScene = generateScene({
      projectId: id,
      segment: {
        id: "",
        index: insertIndex,
        startSec,
        endSec,
        section: "verse",
        emotion: "anticipation",
        intensity: 0.5,
      },
      totalSegments: scenes.length + 1,
      songTitle: project.title,
      artistName: project.artist,
      visualStyle,
      brandDirection: project.brandDirection,
      lyrics: project.lyrics,
      seed: `${id}-manual-${Date.now()}`,
    });
    newScene.segmentId = null;

    await tx.insert(storyboardScenesTable).values(newScene);
    return reindexProject(tx, id);
  });

  res.status(201).json(result);
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
    "environment",
    "characterAction",
    "emotionalPurpose",
    "motionIntensity",
    "aiPrompt",
    "locked",
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

router.delete("/storyboard/:sceneId", async (req, res) => {
  const sceneId = req.params.sceneId;
  const result = await db.transaction(async (tx) => {
    const [scene] = await tx
      .select()
      .from(storyboardScenesTable)
      .where(eq(storyboardScenesTable.id, sceneId));
    if (!scene) return null;
    await tx.delete(storyboardScenesTable).where(eq(storyboardScenesTable.id, sceneId));
    return reindexProject(tx, scene.projectId);
  });
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(result);
});

router.post("/storyboard/:sceneId/regenerate", async (req, res) => {
  const sceneId = req.params.sceneId;
  const force = req.query.force === "true" || req.body?.force === true;
  const [scene] = await db
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.id, sceneId));
  if (!scene) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (scene.locked && !force) {
    res.status(409).json({
      error: "Scene is locked",
      message: "Unlock the scene or pass ?force=true to regenerate.",
    });
    return;
  }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, scene.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const segment = scene.segmentId
    ? (
        await db
          .select()
          .from(timelineSegmentsTable)
          .where(eq(timelineSegmentsTable.id, scene.segmentId))
      )[0]
    : undefined;

  const visualStyle = resolveStyle(project.visualStyle);
  const totalScenes = (await loadProjectScenes(db, scene.projectId)).length;
  const lyricsBySceneId = await getLyricsBySceneId(scene.projectId, [scene]);
  const fresh = generateScene({
    projectId: scene.projectId,
    segment: {
      id: scene.segmentId ?? "",
      index: scene.index,
      startSec: scene.startSec,
      endSec: scene.endSec,
      section: segment?.section ?? "verse",
      emotion: segment?.emotion ?? "anticipation",
      intensity: segment?.intensity ?? 0.5,
    },
    totalSegments: totalScenes,
    songTitle: project.title,
    artistName: project.artist,
    visualStyle,
    brandDirection: project.brandDirection,
    lyrics: project.lyrics,
    lyricLinesInScene: lyricsBySceneId.get(scene.id) ?? [],
    seed: `${project.id}-regen-${Date.now()}`,
  });

  const [updated] = await db
    .update(storyboardScenesTable)
    .set({
      title: fresh.title,
      description: fresh.description,
      shotType: fresh.shotType,
      cameraMovement: fresh.cameraMovement,
      location: fresh.location,
      lighting: fresh.lighting,
      colorPalette: fresh.colorPalette,
      wardrobe: fresh.wardrobe,
      notes: fresh.notes,
      environment: fresh.environment,
      characterAction: fresh.characterAction,
      emotionalPurpose: fresh.emotionalPurpose,
      motionIntensity: fresh.motionIntensity,
      aiPrompt: fresh.aiPrompt,
    })
    .where(eq(storyboardScenesTable.id, sceneId))
    .returning();
  res.json(updated);
});

router.post("/storyboard/:sceneId/duplicate", async (req, res) => {
  const sceneId = req.params.sceneId;

  const result = await db.transaction(async (tx) => {
    const [scene] = await tx
      .select()
      .from(storyboardScenesTable)
      .where(eq(storyboardScenesTable.id, sceneId));
    if (!scene) return null;
    const projectId = scene.projectId;
    const newIndex = scene.index + 1;

    const after = await tx
      .select()
      .from(storyboardScenesTable)
      .where(
        and(
          eq(storyboardScenesTable.projectId, projectId),
          gte(storyboardScenesTable.index, newIndex),
        ),
      );
    for (const s of after) {
      await tx
        .update(storyboardScenesTable)
        .set({ index: s.index + 1 })
        .where(eq(storyboardScenesTable.id, s.id));
    }

    const { id: _id, ...rest } = scene;
    await tx.insert(storyboardScenesTable).values({
      ...rest,
      index: newIndex,
      locked: false,
      title: `${scene.title} (Copy)`,
    });

    return reindexProject(tx, projectId);
  });

  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(201).json(result);
});

export default router;
