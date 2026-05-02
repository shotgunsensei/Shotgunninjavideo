import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { projectsTable } from "./projects";

export const activityTable = pgTable("activity", {
  id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
  projectId: varchar("project_id", { length: 32 }).notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Activity = typeof activityTable.$inferSelect;
export type InsertActivity = typeof activityTable.$inferInsert;
