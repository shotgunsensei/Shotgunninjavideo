import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { projectsTable } from "./projects";

export const exportsTable = pgTable("exports", {
  id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
  projectId: varchar("project_id", { length: 32 }).notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  format: text("format").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExportRecord = typeof exportsTable.$inferSelect;
export type InsertExport = typeof exportsTable.$inferInsert;
