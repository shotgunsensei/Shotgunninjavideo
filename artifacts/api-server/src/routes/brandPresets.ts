import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db, brandPresetsTable, projectsTable, storyboardScenesTable } from "@workspace/db";
import {
  CreateBrandPresetBody,
  UpdateBrandPresetBody,
  ApplyBrandPresetToProjectBody,
  SaveProjectAsBrandPresetBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/brand-presets", async (_req, res) => {
  const rows = await db
    .select()
    .from(brandPresetsTable)
    .orderBy(asc(brandPresetsTable.isDefault), asc(brandPresetsTable.name));
  // Defaults first (true sorts after false in asc; flip):
  rows.sort((a, b) => {
    if (a.isDefault === b.isDefault) return a.name.localeCompare(b.name);
    return a.isDefault ? -1 : 1;
  });
  res.json(rows);
});

router.get("/brand-presets/:id", async (req, res) => {
  const [row] = await db
    .select()
    .from(brandPresetsTable)
    .where(eq(brandPresetsTable.id, req.params.id));
  if (!row) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(row);
});

router.post("/brand-presets", async (req, res) => {
  const body = CreateBrandPresetBody.parse(req.body);
  const [created] = await db
    .insert(brandPresetsTable)
    .values({
      name: body.name,
      characterDescription: body.characterDescription ?? null,
      colorPalette: body.colorPalette ?? null,
      visualStyle: body.visualStyle ?? null,
      logoDescription: body.logoDescription ?? null,
      voiceTone: body.voiceTone ?? null,
      recurringSymbols: body.recurringSymbols ?? null,
      cameraLanguage: body.cameraLanguage ?? null,
      negativePromptRules: body.negativePromptRules ?? null,
      watermarkText: body.watermarkText ?? null,
      isDefault: false,
    })
    .returning();
  res.json(created!);
});

router.patch("/brand-presets/:id", async (req, res) => {
  const body = UpdateBrandPresetBody.parse(req.body);
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of [
    "name",
    "characterDescription",
    "colorPalette",
    "visualStyle",
    "logoDescription",
    "voiceTone",
    "recurringSymbols",
    "cameraLanguage",
    "negativePromptRules",
    "watermarkText",
  ] as const) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  const [updated] = await db
    .update(brandPresetsTable)
    .set(update)
    .where(eq(brandPresetsTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(updated);
});

router.post("/brand-presets/:id/duplicate", async (req, res) => {
  const [src] = await db
    .select()
    .from(brandPresetsTable)
    .where(eq(brandPresetsTable.id, req.params.id));
  if (!src) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const [created] = await db
    .insert(brandPresetsTable)
    .values({
      name: `${src.name} (Copy)`,
      characterDescription: src.characterDescription,
      colorPalette: src.colorPalette,
      visualStyle: src.visualStyle,
      logoDescription: src.logoDescription,
      voiceTone: src.voiceTone,
      recurringSymbols: src.recurringSymbols,
      cameraLanguage: src.cameraLanguage,
      negativePromptRules: src.negativePromptRules,
      watermarkText: src.watermarkText,
      isDefault: false,
    })
    .returning();
  res.json(created!);
});

router.delete("/brand-presets/:id", async (req, res) => {
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(brandPresetsTable)
      .where(eq(brandPresetsTable.id, req.params.id));
    if (!row) return { status: 404 as const };
    if (row.isDefault) return { status: 409 as const };
    // Atomically detach from any projects using it, then delete.
    await tx
      .update(projectsTable)
      .set({ brandPresetId: null })
      .where(eq(projectsTable.brandPresetId, row.id));
    await tx.delete(brandPresetsTable).where(eq(brandPresetsTable.id, row.id));
    return { status: 204 as const };
  });

  if (result.status === 404) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (result.status === 409) {
    res.status(409).json({ error: "cannot_delete_default" });
    return;
  }
  res.status(204).end();
});

// Apply a preset to a project: links preset and copies key brand fields onto
// the project so the rest of the pipeline (storyboard, prompts, exports) sees
// them without having to join through brand_presets.
router.post("/projects/:id/apply-brand-preset", async (req, res) => {
  const body = ApplyBrandPresetToProjectBody.parse(req.body);

  const outcome = await db.transaction(async (tx) => {
    const [project] = await tx
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, req.params.id));
    if (!project) return { status: "project_not_found" as const };

    if (body.presetId === null) {
      const [updated] = await tx
        .update(projectsTable)
        .set({ brandPresetId: null, updatedAt: new Date() })
        .where(eq(projectsTable.id, project.id))
        .returning();
      return { status: "ok" as const, project: updated! };
    }

    // Re-read inside the transaction so a concurrent delete can't leave us
    // with a dangling brandPresetId.
    const [preset] = await tx
      .select()
      .from(brandPresetsTable)
      .where(eq(brandPresetsTable.id, body.presetId));
    if (!preset) return { status: "preset_not_found" as const };

    const firstHex = preset.colorPalette
      ?.split(",")
      .map((s) => s.trim())
      .find((s) => /^#[0-9A-Fa-f]{6}$/.test(s));

    const brandSummary = [
      preset.visualStyle,
      preset.voiceTone ? `Voice: ${preset.voiceTone}` : null,
      preset.recurringSymbols ? `Motifs: ${preset.recurringSymbols}` : null,
      preset.cameraLanguage ? `Camera: ${preset.cameraLanguage}` : null,
    ]
      .filter(Boolean)
      .join(" — ");

    const [updated] = await tx
      .update(projectsTable)
      .set({
        brandPresetId: preset.id,
        visualStyle: preset.visualStyle ?? project.visualStyle,
        visualDirection: preset.visualStyle ?? project.visualDirection,
        brandDirection: brandSummary || project.brandDirection,
        coverColor: firstHex ?? project.coverColor,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, project.id))
      .returning();
    return { status: "ok" as const, project: updated! };
  });

  if (outcome.status === "project_not_found") {
    res.status(404).json({ error: "project_not_found" });
    return;
  }
  if (outcome.status === "preset_not_found") {
    res.status(404).json({ error: "preset_not_found" });
    return;
  }
  res.json(outcome.project);
});

// Snapshot the project's brand fields into a new preset.
router.post("/projects/:id/save-as-brand-preset", async (req, res) => {
  const body = SaveProjectAsBrandPresetBody.parse(req.body ?? {});
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, req.params.id));
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }

  // Aggregate from scenes for richer fields when available.
  const scenes = await db
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, project.id));

  const palette = new Set<string>();
  if (project.coverColor) palette.add(project.coverColor);
  for (const s of scenes) {
    if (!s.colorPalette) continue;
    for (const hex of s.colorPalette.split(",").map((x) => x.trim())) {
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) palette.add(hex);
    }
  }

  const cameraTally = new Map<string, number>();
  for (const s of scenes) {
    const c = s.cameraMovement?.trim();
    if (!c) continue;
    cameraTally.set(c, (cameraTally.get(c) ?? 0) + 1);
  }
  const cameraLanguage = [...cameraTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((e) => e[0])
    .join(", ");

  const wardrobeSet = new Set<string>();
  for (const s of scenes) {
    const w = s.wardrobe?.trim();
    if (w) wardrobeSet.add(w);
  }
  const characterDescription = [...wardrobeSet].slice(0, 3).join(" / ") || null;

  const [created] = await db
    .insert(brandPresetsTable)
    .values({
      name: body.name?.trim() || `${project.title} (Saved Preset)`,
      characterDescription,
      colorPalette: palette.size ? [...palette].slice(0, 6).join(", ") : null,
      visualStyle: project.visualStyle ?? project.visualDirection ?? null,
      logoDescription: null,
      voiceTone: project.mood ?? null,
      recurringSymbols: null,
      cameraLanguage: cameraLanguage || null,
      negativePromptRules:
        "low quality, watermark, text, blurry, deformed, cartoon",
      watermarkText: project.artist ?? project.title,
      isDefault: false,
    })
    .returning();
  res.json(created!);
});

export default router;
