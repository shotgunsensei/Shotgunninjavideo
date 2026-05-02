import { pgTable, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { projectsTable } from "./projects";

export const activityTable = pgTable(
  "activity",
  {
    id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
    projectId: varchar("project_id", { length: 32 }).notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index("activity_project_id_idx").on(t.projectId),
    createdAtIdx: index("activity_created_at_idx").on(t.createdAt),
  }),
);

export type Activity = typeof activityTable.$inferSelect;
export type InsertActivity = typeof activityTable.$inferInsert;
