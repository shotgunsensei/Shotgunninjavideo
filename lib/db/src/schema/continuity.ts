import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const continuityTable = pgTable("continuity", {
  projectId: varchar("project_id", { length: 32 })
    .primaryKey()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  mainCharacter: text("main_character").notNull().default(""),
  outfit: text("outfit").notNull().default(""),
  faceStyle: text("face_style").notNull().default(""),
  vehicleProps: text("vehicle_props").notNull().default(""),
  logoSymbol: text("logo_symbol").notNull().default(""),
  brandStyle: text("brand_style").notNull().default(""),
  colorPalette: text("color_palette").notNull().default(""),
  locationWorld: text("location_world").notNull().default(""),
  environmentRules: text("environment_rules").notNull().default(""),
  recurringMotifs: text("recurring_motifs").notNull().default(""),
  negativePromptLibrary: text("negative_prompt_library").notNull().default(""),
  lockEnabled: boolean("lock_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Continuity = typeof continuityTable.$inferSelect;
export type InsertContinuity = typeof continuityTable.$inferInsert;
