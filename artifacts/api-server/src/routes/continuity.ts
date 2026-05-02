import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  continuityTable,
  projectsTable,
  storyboardScenesTable,
  activityTable,
  type Continuity,
  type StoryboardScene,
} from "@workspace/db";
import { UpdateContinuityBody } from "@workspace/api-zod";

const router: IRouter = Router();

const CONTINUITY_KEYS = [
  "mainCharacter",
  "outfit",
  "faceStyle",
  "vehicleProps",
  "logoSymbol",
  "brandStyle",
  "colorPalette",
  "locationWorld",
  "environmentRules",
  "recurringMotifs",
  "negativePromptLibrary",
  "lockEnabled",
] as const;

function defaultContinuity(projectId: string): Continuity {
  return {
    projectId,
    mainCharacter: "",
    outfit: "",
    faceStyle: "",
    vehicleProps: "",
    logoSymbol: "",
    brandStyle: "",
    colorPalette: "",
    locationWorld: "",
    environmentRules: "",
    recurringMotifs: "",
    negativePromptLibrary: "",
    lockEnabled: false,
    updatedAt: new Date(),
  };
}

async function ensureProject(id: string) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  return project;
}

router.get("/projects/:id/continuity", async (req, res) => {
  const id = req.params.id;
  const project = await ensureProject(id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(continuityTable)
    .where(eq(continuityTable.projectId, id));
  res.json(row ?? defaultContinuity(id));
});

router.put("/projects/:id/continuity", async (req, res) => {
  const id = req.params.id;
  const project = await ensureProject(id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const body = UpdateContinuityBody.parse(req.body ?? {});
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of CONTINUITY_KEYS) {
    if (body[k] !== undefined) updateData[k] = body[k];
  }

  const [existing] = await db
    .select()
    .from(continuityTable)
    .where(eq(continuityTable.projectId, id));

  let saved: Continuity;
  if (existing) {
    const [updated] = await db
      .update(continuityTable)
      .set(updateData)
      .where(eq(continuityTable.projectId, id))
      .returning();
    saved = updated!;
  } else {
    const [inserted] = await db
      .insert(continuityTable)
      .values({ projectId: id, ...updateData })
      .returning();
    saved = inserted!;
  }
  res.json(saved);
});

// Case-insensitive substring presence — but treat the empty string as "not
// present" so that empty continuity fields never short-circuit the merge logic.
function containsCi(haystack: string, needle: string): boolean {
  const n = needle.trim();
  if (!n) return false;
  return haystack.toLowerCase().includes(n.toLowerCase());
}

function mergeIntoScene(
  scene: StoryboardScene,
  c: Continuity,
): Partial<StoryboardScene> {
  const patch: Partial<StoryboardScene> = {};

  // characterAction: prepend main character + outfit + face style hint if at
  // least one of those tokens is missing from the current string. We dedupe
  // each token independently so partial continuity (outfit-only, face-only,
  // etc.) still gets applied.
  const charTokens = [
    c.mainCharacter.trim(),
    c.outfit.trim() ? `wearing ${c.outfit.trim()}` : "",
    c.faceStyle.trim() ? `face: ${c.faceStyle.trim()}` : "",
  ].filter(Boolean);
  if (charTokens.length > 0) {
    const current = scene.characterAction ?? "";
    const missing = charTokens.filter((t) => !containsCi(current, t));
    if (missing.length > 0) {
      const prefix = missing.join(", ");
      patch.characterAction = current ? `${prefix} — ${current}` : prefix;
    }
  }

  // wardrobe: override entirely when outfit is provided.
  if (c.outfit.trim()) {
    patch.wardrobe = c.outfit.trim();
  }

  // environment: prepend world + rules. Each is handled independently so
  // env-rules-only continuity (no world set) still surfaces in scene data.
  const world = c.locationWorld.trim();
  const rules = c.environmentRules.trim();
  if (world || rules) {
    const current = scene.environment ?? "";
    const tokens: string[] = [];
    if (world && !containsCi(current, world)) tokens.push(world);
    if (rules && !containsCi(current, rules)) tokens.push(`rules: ${rules}`);
    if (tokens.length > 0) {
      const fragment = tokens.join(" — ");
      patch.environment = current ? `${fragment} — ${current}` : fragment;
    }
  }

  // colorPalette: override when continuity palette set.
  if (c.colorPalette.trim()) {
    patch.colorPalette = c.colorPalette.trim();
  }

  // notes: append motifs / vehicle / logo references if missing.
  const noteAdditions: string[] = [];
  if (c.recurringMotifs.trim()) noteAdditions.push(`Motifs: ${c.recurringMotifs.trim()}`);
  if (c.vehicleProps.trim()) noteAdditions.push(`Props: ${c.vehicleProps.trim()}`);
  if (c.logoSymbol.trim()) noteAdditions.push(`Logo: ${c.logoSymbol.trim()}`);
  if (noteAdditions.length > 0) {
    const current = scene.notes ?? "";
    const fresh = noteAdditions.filter((n) => !containsCi(current, n));
    if (fresh.length > 0) {
      patch.notes = current ? `${current}\n${fresh.join(" • ")}` : fresh.join(" • ");
    }
  }

  return patch;
}

router.post("/projects/:id/continuity/apply", async (req, res) => {
  const id = req.params.id;
  const project = await ensureProject(id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  // Always count scenes first so the response is honest even when no continuity
  // row exists yet (avoids a misleading "0 scenes" UX).
  const scenes = await db
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, id))
    .orderBy(storyboardScenesTable.index);
  const totalScenes = scenes.length;
  const skippedLockedCount = scenes.filter((s) => s.locked).length;

  const [continuity] = await db
    .select()
    .from(continuityTable)
    .where(eq(continuityTable.projectId, id));
  if (!continuity) {
    res.json({ updatedSceneCount: 0, skippedLockedCount, totalScenes });
    return;
  }

  let updatedSceneCount = 0;
  for (const scene of scenes) {
    if (scene.locked) continue;
    const patch = mergeIntoScene(scene, continuity);
    if (Object.keys(patch).length === 0) continue;
    await db
      .update(storyboardScenesTable)
      .set(patch)
      .where(
        and(
          eq(storyboardScenesTable.id, scene.id),
          eq(storyboardScenesTable.projectId, id),
        ),
      );
    updatedSceneCount += 1;
  }

  await db.insert(activityTable).values({
    projectId: id,
    kind: "storyboard_generated",
    message: `Applied continuity to ${updatedSceneCount} scene${updatedSceneCount === 1 ? "" : "s"} (skipped ${skippedLockedCount} locked)`,
  });

  res.json({ updatedSceneCount, skippedLockedCount, totalScenes });
});

export default router;
