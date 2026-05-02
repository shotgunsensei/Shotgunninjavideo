import { pgTable, text, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { projectsTable } from "./projects";

export const MARKETING_ASSET_KINDS = [
  "youtube_titles",
  "youtube_description",
  "tiktok_caption",
  "instagram_caption",
  "facebook_caption",
  "hashtags",
  "teaser_15s",
  "teaser_30s",
  "trailer_60s",
  "thumbnail_prompt",
  "cover_art_prompt",
  "behind_the_scenes",
  "release_announcement",
] as const;

export type MarketingAssetKind = (typeof MARKETING_ASSET_KINDS)[number];

export const marketingAssetsTable = pgTable(
  "marketing_assets",
  {
    id: varchar("id", { length: 32 }).primaryKey().$defaultFn(() => createId()),
    projectId: varchar("project_id", { length: 32 })
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // One asset per (project, kind). Regenerate overwrites in place.
    projectKindUnique: uniqueIndex("marketing_assets_project_kind_unique").on(
      t.projectId,
      t.kind,
    ),
  }),
);

export type MarketingAsset = typeof marketingAssetsTable.$inferSelect;
export type InsertMarketingAsset = typeof marketingAssetsTable.$inferInsert;
