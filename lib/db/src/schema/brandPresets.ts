import { pgTable, text, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const brandPresetsTable = pgTable("brand_presets", {
  id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  characterDescription: text("character_description"),
  colorPalette: text("color_palette"),
  visualStyle: text("visual_style"),
  logoDescription: text("logo_description"),
  voiceTone: text("voice_tone"),
  recurringSymbols: text("recurring_symbols"),
  cameraLanguage: text("camera_language"),
  negativePromptRules: text("negative_prompt_rules"),
  watermarkText: text("watermark_text"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BrandPreset = typeof brandPresetsTable.$inferSelect;
export type InsertBrandPreset = typeof brandPresetsTable.$inferInsert;
