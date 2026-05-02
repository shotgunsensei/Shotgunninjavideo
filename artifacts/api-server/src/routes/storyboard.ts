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
  type TimelineSegment,
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
  const id = req.params.id;
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }
  const scenes = await loadProjectScenes(db, id);
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
      // Critically: do NOT early-return here — the status bump + activity
      // row at the end of the tx body must run for both branches. (An
      // earlier version `return inserted;`-d here, which silently skipped
      // the status update for force=true regenerations, leaving stale
      // statuses like "exported" sticky across regenerations.)
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
    } else {
      // Non-force: preserve every locked scene (including manually-added
      // ones with null segmentId). Inlined below — kept inside the same
      // tx body so the trailing status bump applies to both branches.
      await runIncrementalRegen({
        tx,
        existing,
        segments,
        project,
        id,
        visualStyle,
        brandDirection,
        lyrics,
        lyricsForSegment,
        remapLyricSceneIds,
      });
    }

    // Status bump + activity row MUST be in the same transaction as the
    // scene mutations and MUST run for BOTH the force and non-force
    // branches above. If we commit scenes and then crash before the
    // status bump, or skip it for force=true, the project is left in an
    // inconsistent state where the UI gating (status === 'storyboarded')
    // disagrees with the actual scene rows.
    const finalScenes = await loadProjectScenes(tx, id);
    await tx
      .update(projectsTable)
      .set({ status: "storyboarded", updatedAt: new Date() })
      .where(eq(projectsTable.id, id));
    await tx.insert(activityTable).values({
      projectId: id,
      kind: "storyboard_generated",
      message: `Generated ${finalScenes.length} storyboard scenes (${VISUAL_STYLES[visualStyle].label})`,
    });
    return finalScenes;
  });

  res.status(201).json(inserted);
});

// Helper extracted from the non-force regen branch above. Runs inside the
// caller's transaction so the whole storyboard regen — including the
// trailing status bump — is one atomic unit.
async function runIncrementalRegen(args: {
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
  existing: StoryboardScene[];
  segments: TimelineSegment[];
  project: { title: string; artist: string | null };
  id: string;
  visualStyle: keyof typeof VISUAL_STYLES;
  brandDirection: string | null | undefined;
  lyrics: string | null | undefined;
  lyricsForSegment: (seg: TimelineSegment) => string[];
  remapLyricSceneIds: (newScenes: StoryboardScene[]) => Promise<void>;
}): Promise<void> {
  const {
    tx,
    existing,
    segments,
    project,
    id,
    visualStyle,
    brandDirection,
    lyrics,
    lyricsForSegment,
    remapLyricSceneIds,
  } = args;

  const lockedBySegment = new Map<string, StoryboardScene>();
  const lockedFloating: StoryboardScene[] = [];
  for (const s of existing) {
    if (!s.locked) continue;
    if (s.segmentId && !lockedBySegment.has(s.segmentId)) {
      lockedBySegment.set(s.segmentId, s);
    } else {
      lockedFloating.push({ ...s, segmentId: null });
    }
  }

  const toDelete = existing.filter((s) => !s.locked).map((s) => s.id);
  for (const sceneId of toDelete) {
    await tx.delete(storyboardScenesTable).where(eq(storyboardScenesTable.id, sceneId));
  }

  for (const f of lockedFloating) {
    if (existing.find((s) => s.id === f.id)?.segmentId !== null) {
      await tx
        .update(storyboardScenesTable)
        .set({ segmentId: null })
        .where(eq(storyboardScenesTable.id, f.id));
    }
  }

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

  const allAfterInsert = await loadProjectScenes(tx, id);
  await remapLyricSceneIds(allAfterInsert);

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
}

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
  // Coerce truthy strings ("true", "1") on either query or JSON body to a real
  // boolean. Anything else is treated as false so a malformed body can't
  // accidentally bypass the lock.
  const force =
    req.query.force === "true" ||
    req.query.force === "1" ||
    req.body?.force === true ||
    req.body?.force === "true";
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
