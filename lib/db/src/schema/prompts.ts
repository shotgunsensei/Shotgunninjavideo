import { pgTable, text, doublePrecision, varchar, integer, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { projectsTable } from "./projects";
import { storyboardScenesTable } from "./storyboard";

export const promptsTable = pgTable(
  "prompts",
  {
    id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
    projectId: varchar("project_id", { length: 32 }).notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    sceneId: varchar("scene_id", { length: 32 }).notNull().references(() => storyboardScenesTable.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    model: text("model").notNull().default("generic"),
    text: text("text").notNull(),
    negativePrompt: text("negative_prompt"),
    aspectRatio: text("aspect_ratio").default("16:9"),
    durationSec: doublePrecision("duration_sec"),
  },
  (t) => ({
    projectIdx: index("prompts_project_id_idx").on(t.projectId),
    sceneIdx: index("prompts_scene_id_idx").on(t.sceneId),
  }),
);

export type Prompt = typeof promptsTable.$inferSelect;
export type InsertPrompt = typeof promptsTable.$inferInsert;
