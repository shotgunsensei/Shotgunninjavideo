import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function ensureSettings() {
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  if (existing) return existing;
  const [created] = await db
    .insert(settingsTable)
    .values({ id: 1 })
    .returning();
  return created!;
}

router.get("/settings", async (_req, res) => {
  const s = await ensureSettings();
  res.json(s);
});

router.put("/settings", async (req, res) => {
  await ensureSettings();
  const body = UpdateSettingsBody.parse(req.body);
  const updateData: Record<string, unknown> = {};
  for (const k of [
    "defaultModel",
    "defaultAspectRatio",
    "defaultSceneDurationSec",
    "theme",
    "creatorName",
    "creatorHandle",
  ] as const) {
    if (body[k] !== undefined) updateData[k] = body[k];
  }
  const [updated] = await db
    .update(settingsTable)
    .set(updateData)
    .where(eq(settingsTable.id, 1))
    .returning();
  res.json(updated!);
});

export default router;
