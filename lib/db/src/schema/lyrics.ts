import { pgTable, text, doublePrecision, varchar, integer, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { projectsTable } from "./projects";
import { storyboardScenesTable } from "./storyboard";

export const lyricLinesTable = pgTable(
  "lyric_lines",
  {
    id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
    projectId: varchar("project_id", { length: 32 })
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    text: text("text").notNull(),
    timestampSec: doublePrecision("timestamp_sec"),
    sceneId: varchar("scene_id", { length: 32 }).references(
      () => storyboardScenesTable.id,
      { onDelete: "set null" },
    ),
  },
  (t) => ({
    projectIdx: index("lyric_lines_project_id_idx").on(t.projectId),
    sceneIdx: index("lyric_lines_scene_id_idx").on(t.sceneId),
  }),
);

export type LyricLine = typeof lyricLinesTable.$inferSelect;
export type InsertLyricLine = typeof lyricLinesTable.$inferInsert;
