import { pgTable, text, doublePrecision, varchar, integer, boolean, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { projectsTable } from "./projects";
import { timelineSegmentsTable } from "./timeline";

export const storyboardScenesTable = pgTable(
  "storyboard_scenes",
  {
    id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
    projectId: varchar("project_id", { length: 32 }).notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    segmentId: varchar("segment_id", { length: 32 }).references(() => timelineSegmentsTable.id, { onDelete: "set null" }),
    index: integer("index").notNull(),
    startSec: doublePrecision("start_sec").notNull(),
    endSec: doublePrecision("end_sec").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    shotType: text("shot_type").notNull(),
    cameraMovement: text("camera_movement").notNull(),
    location: text("location").notNull(),
    lighting: text("lighting").notNull(),
    colorPalette: text("color_palette").notNull(),
    wardrobe: text("wardrobe"),
    notes: text("notes"),
    environment: text("environment").notNull().default(""),
    characterAction: text("character_action").notNull().default(""),
    emotionalPurpose: text("emotional_purpose").notNull().default(""),
    motionIntensity: text("motion_intensity").notNull().default("medium"),
    aiPrompt: text("ai_prompt").notNull().default(""),
    locked: boolean("locked").notNull().default(false),
  },
  (t) => ({
    projectIdx: index("storyboard_scenes_project_id_idx").on(t.projectId),
    segmentIdx: index("storyboard_scenes_segment_id_idx").on(t.segmentId),
  }),
);

export type StoryboardScene = typeof storyboardScenesTable.$inferSelect;
export type InsertStoryboardScene = typeof storyboardScenesTable.$inferInsert;
