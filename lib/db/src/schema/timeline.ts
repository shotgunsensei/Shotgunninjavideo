import { pgTable, text, doublePrecision, varchar, integer, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { projectsTable } from "./projects";

export const timelineSegmentsTable = pgTable("timeline_segments", {
  id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
  projectId: varchar("project_id", { length: 32 }).notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  startSec: doublePrecision("start_sec").notNull(),
  endSec: doublePrecision("end_sec").notNull(),
  section: text("section").notNull(),
  intensity: doublePrecision("intensity").notNull(),
  emotion: text("emotion").notNull(),
  bpm: doublePrecision("bpm"),
});

export const analysisTable = pgTable("analysis", {
  projectId: varchar("project_id", { length: 32 }).primaryKey().references(() => projectsTable.id, { onDelete: "cascade" }),
  durationSec: doublePrecision("duration_sec").notNull(),
  bpm: doublePrecision("bpm").notNull(),
  keySignature: text("key_signature").notNull(),
  energy: doublePrecision("energy").notNull(),
  loudnessDb: doublePrecision("loudness_db"),
  emotionalMap: jsonb("emotional_map").notNull(),
});

export type TimelineSegment = typeof timelineSegmentsTable.$inferSelect;
export type InsertTimelineSegment = typeof timelineSegmentsTable.$inferInsert;
export type AnalysisRow = typeof analysisTable.$inferSelect;
export type InsertAnalysis = typeof analysisTable.$inferInsert;
