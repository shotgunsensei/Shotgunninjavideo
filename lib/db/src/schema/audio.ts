import { pgTable, text, timestamp, doublePrecision, varchar, integer, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { projectsTable } from "./projects";

export const audioFilesTable = pgTable(
  "audio_files",
  {
    id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
    projectId: varchar("project_id", { length: 32 }).notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    durationSec: doublePrecision("duration_sec"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index("audio_files_project_id_idx").on(t.projectId),
  }),
);

export type AudioFile = typeof audioFilesTable.$inferSelect;
export type InsertAudioFile = typeof audioFilesTable.$inferInsert;
