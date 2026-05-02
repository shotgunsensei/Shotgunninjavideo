import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  storyboardScenesTable,
  promptsTable,
  exportsTable,
  activityTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/stats/overview", async (_req, res) => {
  const [{ c: totalProjects } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(projectsTable);
  const [{ c: totalScenes } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(storyboardScenesTable);
  const [{ c: totalPrompts } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(promptsTable);
  const [{ c: totalExports } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(exportsTable);
  const [{ c: analyzedProjects } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(projectsTable)
    .where(sql`status IN ('analyzed','storyboarded','prompted','exported')`);

  res.json({ totalProjects, totalScenes, totalPrompts, totalExports, analyzedProjects });
});

router.get("/stats/recent-activity", async (_req, res) => {
  const rows = await db
    .select({
      id: activityTable.id,
      kind: activityTable.kind,
      message: activityTable.message,
      projectId: activityTable.projectId,
      projectTitle: projectsTable.title,
      createdAt: activityTable.createdAt,
    })
    .from(activityTable)
    .leftJoin(projectsTable, sql`${projectsTable.id} = ${activityTable.projectId}`)
    .orderBy(desc(activityTable.createdAt))
    .limit(20);
  res.json(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      message: r.message,
      projectId: r.projectId,
      projectTitle: r.projectTitle ?? undefined,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;
