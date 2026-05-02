import { pgTable, text, doublePrecision, integer } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  defaultModel: text("default_model").notNull().default("generic"),
  defaultAspectRatio: text("default_aspect_ratio").notNull().default("16:9"),
  defaultSceneDurationSec: doublePrecision("default_scene_duration_sec").notNull().default(6),
  theme: text("theme").notNull().default("dark"),
  creatorName: text("creator_name"),
  creatorHandle: text("creator_handle"),
});

export type Settings = typeof settingsTable.$inferSelect;
export type InsertSettings = typeof settingsTable.$inferInsert;
