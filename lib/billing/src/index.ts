// Single source of truth for monetization in Shotgun Ninjas.
//
// This package is intentionally pure (no DB, no fetch, no env access) so it can
// be imported by both the API server and the React client. When Stripe is wired
// up later, the catalog below maps 1:1 to Stripe Prices via `stripePriceId`.

export const PLAN_IDS = ["free", "creator", "studio", "agency"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "cancelled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// Every gateable capability in the app. Routes/UI reference these constants
// instead of hard-coding plan names, so a feature can be re-tiered by editing
// just the catalog below.
export const FEATURES = [
  "unlimited_projects",
  "advanced_storyboard",
  "platform_prompt_packs",
  "json_export",
  "csv_export",
  "lyrics_alignment",
  "batch_projects",
  "brand_continuity_lock",
  "treatment_export",
  "social_captions",
  "advanced_editing_guides",
  "team_workspace",
  "white_label_exports",
  "client_folders",
  "brand_presets",
  "priority_render",
] as const;
export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABELS: Record<Feature, string> = {
  unlimited_projects: "Unlimited projects",
  advanced_storyboard: "Advanced storyboard generation",
  platform_prompt_packs: "Platform-specific prompt packs",
  json_export: "JSON export",
  csv_export: "CSV shot list export",
  lyrics_alignment: "Lyrics alignment",
  batch_projects: "Batch projects",
  brand_continuity_lock: "Brand continuity lock",
  treatment_export: "Client-facing treatment exports",
  social_captions: "Social caption packs",
  advanced_editing_guides: "Advanced editing guides (CapCut / DaVinci)",
  team_workspace: "Team workspace",
  white_label_exports: "White-label exports",
  client_folders: "Client project folders",
  brand_presets: "Reusable brand presets",
  priority_render: "Priority render workflow",
};

export interface PlanCatalogItem {
  id: PlanId;
  name: string;
  tagline: string;
  priceCents: number;
  priceInterval: "month" | "year" | "free";
  /** null = unlimited */
  projectLimit: number | null;
  features: Feature[];
  /** Display-only marketing bullets (in order). Includes feature labels and limit copy. */
  highlights: string[];
  /** Future Stripe wiring — set when Stripe is connected. */
  stripePriceId: string | null;
  ctaLabel: string;
}

const FREE_FEATURES: Feature[] = [];
const CREATOR_FEATURES: Feature[] = [
  "unlimited_projects",
  "advanced_storyboard",
  "platform_prompt_packs",
  "json_export",
  "csv_export",
  "lyrics_alignment",
];
const STUDIO_FEATURES: Feature[] = [
  ...CREATOR_FEATURES,
  "batch_projects",
  "brand_continuity_lock",
  "treatment_export",
  "social_captions",
  "advanced_editing_guides",
];
const AGENCY_FEATURES: Feature[] = [
  ...STUDIO_FEATURES,
  "team_workspace",
  "white_label_exports",
  "client_folders",
  "brand_presets",
  "priority_render",
];

export const PLAN_CATALOG: Record<PlanId, PlanCatalogItem> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try the engine on a couple of tracks.",
    priceCents: 0,
    priceInterval: "free",
    projectLimit: 2,
    features: FREE_FEATURES,
    highlights: [
      "2 projects",
      "Basic audio analysis",
      "Basic storyboard",
      "Basic TXT export",
    ],
    stripePriceId: null,
    ctaLabel: "Current plan",
  },
  creator: {
    id: "creator",
    name: "Creator Pro",
    tagline: "For solo artists shipping music videos every week.",
    priceCents: 999,
    priceInterval: "month",
    projectLimit: null,
    features: CREATOR_FEATURES,
    highlights: [
      "Unlimited projects",
      "Advanced storyboard generation",
      "Platform-specific prompt packs",
      "JSON / CSV exports",
      "Lyrics alignment",
    ],
    stripePriceId: null,
    ctaLabel: "Upgrade to Creator",
  },
  studio: {
    id: "studio",
    name: "Studio Pro",
    tagline: "For producers, directors and small studios.",
    priceCents: 2900,
    priceInterval: "month",
    projectLimit: null,
    features: STUDIO_FEATURES,
    highlights: [
      "Batch projects",
      "Brand continuity lock",
      "Client-facing treatment exports",
      "Social caption packs",
      "Advanced editing guides (CapCut / DaVinci)",
    ],
    stripePriceId: null,
    ctaLabel: "Upgrade to Studio",
  },
  agency: {
    id: "agency",
    name: "Agency",
    tagline: "For teams and agencies running multiple artists.",
    priceCents: 7900,
    priceInterval: "month",
    projectLimit: null,
    features: AGENCY_FEATURES,
    highlights: [
      "Team workspace",
      "White-label exports",
      "Client project folders",
      "Reusable brand presets",
      "Priority render workflow",
    ],
    stripePriceId: null,
    ctaLabel: "Upgrade to Agency",
  },
};

export const PLAN_ORDER: Record<PlanId, number> = {
  free: 0,
  creator: 1,
  studio: 2,
  agency: 3,
};

/** Maps each export format string to the feature required to use it.
 *  null = available on Free. Source of truth for the export gate. */
export const EXPORT_FORMAT_GATE: Record<string, Feature | null> = {
  // Free tier
  production_plan: null,
  txt: null,
  // Creator Pro
  json: "json_export",
  csv_shot_list: "csv_export",
  lyrics_timing: "lyrics_alignment",
  ai_prompt_pack: "platform_prompt_packs",
  // Studio Pro
  capcut_guide: "advanced_editing_guides",
  davinci_guide: "advanced_editing_guides",
  treatment: "treatment_export",
  social_captions: "social_captions",
};

export function hasFeature(plan: PlanId, feature: Feature): boolean {
  return PLAN_CATALOG[plan].features.includes(feature);
}

export function requiredPlanForFeature(feature: Feature): PlanId {
  for (const id of PLAN_IDS) {
    if (hasFeature(id, feature)) return id;
  }
  return "agency";
}

export function requiredPlanForExportFormat(format: string): PlanId {
  const feat = EXPORT_FORMAT_GATE[format];
  if (!feat) return "free";
  return requiredPlanForFeature(feat);
}

export function isExportFormatAllowed(plan: PlanId, format: string): boolean {
  const feat = EXPORT_FORMAT_GATE[format];
  if (!feat) return true;
  return hasFeature(plan, feat);
}

export function isWithinProjectLimit(plan: PlanId, currentCount: number): boolean {
  const limit = PLAN_CATALOG[plan].projectLimit;
  if (limit === null) return true;
  return currentCount < limit;
}

export function formatPrice(plan: PlanCatalogItem): string {
  if (plan.priceInterval === "free") return "Free";
  const dollars = (plan.priceCents / 100).toFixed(plan.priceCents % 100 === 0 ? 0 : 2);
  return `$${dollars}/${plan.priceInterval === "month" ? "mo" : "yr"}`;
}
