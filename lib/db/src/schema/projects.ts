import { pgTable, text, timestamp, doublePrecision, varchar } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const projectsTable = pgTable("projects", {
  id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  artist: text("artist"),
  genre: text("genre"),
  mood: text("mood"),
  visualDirection: text("visual_direction"),
  status: text("status").notNull().default("draft"),
  coverColor: text("cover_color"),
  durationSec: doublePrecision("duration_sec"),
  bpm: doublePrecision("bpm"),
  keySignature: text("key_signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Project = typeof projectsTable.$inferSelect;
export type InsertProject = typeof projectsTable.$inferInsert;
