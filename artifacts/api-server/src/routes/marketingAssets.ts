import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import {
  db,
  projectsTable,
  storyboardScenesTable,
  brandPresetsTable,
  marketingAssetsTable,
  MARKETING_ASSET_KINDS,
  type MarketingAssetKind,
} from "@workspace/db";
import {
  generateAllMarketingAssets,
  generateMarketingAsset,
  buildMarketingExport,
  MARKETING_KIND_META,
  MARKETING_FORMAT_META,
  type MarketingContext,
  type MarketingExportFormat,
} from "../lib/marketingAssetGenerator";
import { RegenerateMarketingAssetBody } from "@workspace/api-zod";

const VALID_EXPORT_FORMATS: ReadonlyArray<MarketingExportFormat> = ["txt", "csv", "json"];

const router: IRouter = Router();

const KIND_SET = new Set<string>(MARKETING_ASSET_KINDS);

function isKind(s: string): s is MarketingAssetKind {
  return KIND_SET.has(s);
}

async function loadContext(projectId: string): Promise<MarketingContext | null> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  if (!project) return null;
  const scenes = await db
    .select()
    .from(storyboardScenesTable)
    .where(eq(storyboardScenesTable.projectId, projectId))
    .orderBy(asc(storyboardScenesTable.index));
  let brandPreset = null;
  if (project.brandPresetId) {
    const [bp] = await db
      .select()
      .from(brandPresetsTable)
      .where(eq(brandPresetsTable.id, project.brandPresetId));
    brandPreset = bp ?? null;
  }
  return { project, scenes, brandPreset };
}

router.get("/projects/:id/marketing-assets", async (req, res) => {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, req.params.id));
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }
  const rows = await db
    .select()
    .from(marketingAssetsTable)
    .where(eq(marketingAssetsTable.projectId, req.params.id))
    .orderBy(asc(marketingAssetsTable.createdAt));
  res.json(rows);
});

// Generate ALL kinds at once (idempotent — overwrites in place per (project, kind)).
router.post("/projects/:id/marketing-assets/generate", async (req, res) => {
  const ctx = await loadContext(req.params.id);
  if (!ctx) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }

  const generated = generateAllMarketingAssets(ctx);
  const now = new Date();

  const saved = await db.transaction(async (tx) => {
    const out = [];
    for (const g of generated) {
      const [row] = await tx
        .insert(marketingAssetsTable)
        .values({
          projectId: req.params.id,
          kind: g.kind,
          content: g.content,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [marketingAssetsTable.projectId, marketingAssetsTable.kind],
          set: { content: g.content, updatedAt: now },
        })
        .returning();
      out.push(row!);
    }
    return out;
  });

  res.json(saved);
});

// Regenerate ONE kind.
router.post("/projects/:id/marketing-assets/regenerate", async (req, res) => {
  const body = RegenerateMarketingAssetBody.parse(req.body);
  if (!isKind(body.kind)) {
    res.status(400).json({ error: "invalid_kind" });
    return;
  }
  const ctx = await loadContext(req.params.id);
  if (!ctx) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }
  const content = generateMarketingAsset(body.kind, ctx);
  const now = new Date();
  const [row] = await db
    .insert(marketingAssetsTable)
    .values({
      projectId: req.params.id,
      kind: body.kind,
      content,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [marketingAssetsTable.projectId, marketingAssetsTable.kind],
      set: { content, updatedAt: now },
    })
    .returning();
  res.json(row!);
});

// Download as TXT / CSV / JSON.
router.get("/projects/:id/marketing-assets/export/:format", async (req, res) => {
  const formatParam = req.params.format;
  if (!VALID_EXPORT_FORMATS.includes(formatParam as MarketingExportFormat)) {
    res.status(400).json({ error: "invalid_format", message: "format must be txt, csv, or json" });
    return;
  }
  const format = formatParam as MarketingExportFormat;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, req.params.id));
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }

  const rows = await db
    .select()
    .from(marketingAssetsTable)
    .where(eq(marketingAssetsTable.projectId, req.params.id));

  if (rows.length === 0) {
    res.status(409).json({ error: "no_assets", message: "Generate marketing assets first." });
    return;
  }

  // Order by canonical MARKETING_ASSET_KINDS order, dropping any unknown kinds.
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  const ordered = MARKETING_ASSET_KINDS.flatMap((k) => {
    const r = byKind.get(k);
    return r ? [{ kind: k, content: r.content, updatedAt: r.updatedAt }] : [];
  });

  const body = buildMarketingExport(format, project, ordered);
  const meta = MARKETING_FORMAT_META[format];
  const safeTitle = project.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 40) || "project";
  // Always serve as text/plain so the OpenAPI string contract holds — the
  // file extension in Content-Disposition preserves format identity for the
  // browser download UI, and clients can re-parse JSON/CSV themselves.
  res.setHeader("Content-Type", `text/plain; charset=utf-8`);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeTitle}_marketing_pack.${meta.ext}"`,
  );
  res.send(body);
});

// Lightweight metadata endpoint so the frontend can render groups & labels
// without duplicating the catalog.
router.get("/marketing-assets/catalog", (_req, res) => {
  res.json({
    kinds: MARKETING_ASSET_KINDS.map((k) => MARKETING_KIND_META[k]),
    formats: Object.entries(MARKETING_FORMAT_META).map(([format, meta]) => ({
      format,
      ...meta,
    })),
  });
});

export default router;
