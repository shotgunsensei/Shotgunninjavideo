# Workspace

## Overview

Shotgun Ninjas Video Engine — a DIY alternative to AI music video tools (like Sondo). Users upload a song, the app analyzes it, generates a beat-synced cinematic storyboard, scene prompts, and exports a structured production plan.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind v4 + shadcn/ui + wouter + TanStack Query + framer-motion + recharts
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- `artifacts/shotgun-ninjas` (`/`) — React frontend, the main user-facing app
- `artifacts/api-server` (`/api`) — Express API powering all features
- `artifacts/mockup-sandbox` (`/__mockup`) — design canvas

## Data model (lib/db/src/schema)

- `projects` — main project record (title, artist, genre, mood, visualDirection, **visualStyle, brandDirection, lyrics**, status, bpm, key, durationSec)
- `audio_files` — uploaded audio metadata per project
- `analysis` + `timeline_segments` — mock audio analysis (BPM/key/energy/loudness, segments with section + intensity + emotion, emotional map valence/arousal points)
- `storyboard_scenes` — per-segment cinematic scene plan (shot type, camera, location, lighting, palette, wardrobe, **environment, characterAction, emotionalPurpose, motionIntensity, aiPrompt, locked**)
- `lyric_lines` — parsed lyric lines per project (text, optional `timestampSec`, optional `sceneId` for manual assignment). Matched to scenes with this precedence: explicit `sceneId` always wins, otherwise `timestampSec` falls within `[scene.startSec, scene.endSec)`. Single source of truth: `artifacts/api-server/src/lib/lyricsParser.ts#lyricsForScene`.
- `brand_presets` — reusable brand identity packs (id, name, characterDescription, colorPalette, visualStyle, logoDescription, voiceTone, recurringSymbols, cameraLanguage, negativePromptRules, watermarkText, isDefault, timestamps). 7 default presets are seeded idempotently on every server start (Shotgun Ninjas Productions, TorqueShed, TradeFlowKit, TechDeck, PulseDesk, FaultlineLab, Shotgun Ninja Village). `projects.brandPresetId` is a soft FK (no DB constraint to avoid circular schema imports).
- `prompts` — AI video generation prompt per scene (model, text, negative prompt, aspect ratio, duration)
- `exports` — generated exports. Format enum supports: `production_plan`, `txt`, `json`, `csv_shot_list`, `lyrics_timing`, `ai_prompt_pack`, `capcut_guide`, `davinci_guide`, `treatment`, `social_captions`. Builders live in `artifacts/api-server/src/lib/exporters.ts`; `FORMAT_META` maps each to mimeType + fileExtension surfaced via `ExportRecord` so the client downloads with correct mime/ext. CSV cells are sanitized against formula injection (leading `=+-@\t\r` → prefixed with `'`).
- `activity` — recent activity feed
- `settings` — single-row global settings (default model, aspect ratio, scene duration, theme, creator info)

## Workflow

Upload song → "Deep Thinking" analysis (5 stages: Song analysis / Understanding emotions / Conceiving visual ideas / Storyline design / Content preview) → **(optional) Lyrics**: paste raw or `[mm:ss.cs]` / `[hh:mm:ss]` timestamped lyrics, parse, hand-assign untimed lines to scenes, then "Improve Storyboard" to regenerate unlocked scenes informed by per-scene lyric snippets → generate storyboard → **Prompt Engine**: per-scene structured PromptBlock (subject/setting/visualStyle/cameraMotion/lighting/mood/palette/aspect/negative/duration/transition) rendered as 10 platform-specific prompts (Runway, Pika, Kling, Luma, PixVerse, Stable Diffusion, Midjourney, Leonardo, CapCut notes, DaVinci notes) with one-click copy → **Export Center** (`pages/export.tsx`): nine cards (Production Plan, JSON, CSV Shot List, Lyrics Timing Sheet, AI Video Prompt Pack, CapCut Guide, DaVinci Resolve Guide, Client Treatment, Social Caption Pack) each generate-and-download in one click. Every export embeds project title, song metadata, audio analysis, scene timeline, storyboard, scene prompts, editing notes, and the four suggested aspect ratios (16:9 YouTube, 9:16 TikTok/Reels/Shorts, 1:1 Square, 4:5 FB/IG Feed).

Lyric lines whose `sceneId` points at a scene that gets regenerated are remapped via `segmentId` (`remapLyricSceneIds` in `routes/storyboard.ts`) so manual assignments survive both `force` and non-force regeneration.

The Storyboard page (`pages/storyboard.tsx`) lets the director:
- Pick from 10 visual style presets (cyberpunk_uprising, gritty_urban, anime_cinematic, dark_industrial, motivational_founder, street_mv, luxury_cinematic, horror_energy, scifi_neon, custom) defined in `artifacts/api-server/src/lib/sceneGenerator.ts`.
- Add brand direction text and optional lyrics that steer environment/wardrobe/action arrays plus a per-scene AI prompt.
- Per-scene actions: regenerate-all (preserves locked), force regenerate-all (rebuilds everything), regenerate-one (refuses with 409 unless `?force=true`), edit (rich dialog with all fields), duplicate (inserts directly after with " (Copy)" suffix), delete (with confirmation), insert between scenes, append at end, and lock toggle.
- Locked scenes survive batch regeneration regardless of whether they were originally tied to a timeline segment or manually added (segmentId-null floats).
- All multi-row index-shifting operations (regenerate-all, add, duplicate, delete) run inside drizzle transactions to prevent index drift under concurrency.

The analysis screen (`pages/analysis.tsx`) drives the deep-thinking flow via `runDeepThinking(useMock)`:
- Stages 1–2 are powered by real Web Audio analysis when an audio file is cached locally (IndexedDB), with stage substep progress driven by `analyzeAudioFile` callbacks.
- A "Mock Pass" button always works (no audio required) and submits with no body so the API server returns deterministic mock data.
- Stages 3–5 are derived from the result via `lib/visualStyle.ts` (palette/lensing/pacing/descriptors + emotional arc summary).
- The Content Preview stage renders a final summary inline: Audio DNA tiles, emotional arc bar, recommended visual style card, estimated scene count, and "Generate Storyboard" CTA.

Layout (`components/layout.tsx`) collapses the sidebar into a Sheet on mobile (<md) for narrow viewports.

Two demo projects are seeded idempotently on every server start (`artifacts/api-server/src/lib/seed.ts`):

- **"Black Velvet Static" by RONIN/X** — auto-generated cyberpunk_uprising demo (198 s, 124 BPM) showing the standard generative path.
- **"Shotgun Ninjas Rise" by Shotgun Ninjas** — hand-curated 11-plot founder/uprising template (219 s = 03:39, 96 BPM, A min, gritty_urban + crimson neon + rooftops). Each scene is a labeled "Plot 01 — The Empty Workshop" through "Plot 11 — Rise", with bespoke title, description, location, lighting, palette, wardrobe, character action, and AI prompt; LRC-timed sample lyrics (`SN_LYRICS`) are parsed and snapped into the matching scene. Designed to double as the starting template for new Shotgun Ninjas music videos.

Each demo seed checks for its own title before inserting, so the seeder is safe to run on every boot and can add new built-in templates without disturbing existing ones.

## Brand Presets

Reusable visual identity packs at **`/brand-presets`** (sidebar Palette icon). Each preset has 10 fields: brand name, main character description, color palette (comma-separated hex), visual style, logo description, voice/tone, recurring symbols, preferred camera language, negative prompt rules, export watermark text.

- **API**: `GET/POST /api/brand-presets`, `GET/PATCH/DELETE /api/brand-presets/{id}`, `POST /api/brand-presets/{id}/duplicate`, `POST /api/projects/{id}/apply-brand-preset` (body `{presetId: string|null}`), `POST /api/projects/{id}/save-as-brand-preset` (body `{name?}`). Routes in `artifacts/api-server/src/routes/brandPresets.ts`.
- **Apply** copies `visualStyle`, `visualDirection`, an aggregated `brandDirection` summary, and the first valid hex of the palette into `coverColor` on the target project, and sets `projects.brandPresetId`. Pass `presetId: null` to detach.
- **Save-as** snapshots the current project: aggregates unique scene `colorPalette` hexes (plus `coverColor`) into the preset palette, top-3 most-used `cameraMovement`s into camera language, scene `wardrobe` strings into character description, and project `mood` → voice tone, `artist` → watermark.
- **Defaults** (`isDefault=true`) cannot be deleted (server returns 409, frontend hides the trash button). They can be edited and duplicated. Deleting a custom preset detaches it from any project still using it.
- **Project Hub** (`pages/project-hub.tsx`) gained a "Brand Preset" card with an apply Select and a save-as input.
- Naming caveat: orval generates request-body Zod constants from operationIds, so the route file imports `CreateBrandPresetBody` / `UpdateBrandPresetBody` / `ApplyBrandPresetToProjectBody` / `SaveProjectAsBrandPresetBody` even though the OpenAPI schemas are named `CreateBrandPresetInput` etc.

## Billing / Monetization (demo mode)

Plan tiers live in **`lib/billing`** (`PLAN_CATALOG`, `EXPORT_FORMAT_GATE`, helpers). Four plans: **Free** (2 projects, basic exports), **Creator Pro** ($9.99/mo, JSON/CSV/AI prompt pack), **Studio Pro** ($29/mo, every export + brand continuity), **Agency** ($79/mo, white-label, team seats).

- **DB**: `lib/db/src/schema/billing.ts` — single-row table (`id=1`) with `plan`, `status`, stub `stripeCustomerId`/`stripeSubscriptionId`/period fields.
- **API**: `GET /api/billing/plans`, `GET /api/billing`, `POST /api/billing/upgrade`, `POST /api/billing/cancel` (`artifacts/api-server/src/routes/billing.ts`).
- **Provider abstraction**: `artifacts/api-server/src/lib/billingProvider.ts` exposes a `BillingProvider` interface implemented by `MockBillingProvider` (in-DB demo state). `getBillingProvider()` reads `BILLING_PROVIDER` env. To wire Stripe later: implement `StripeBillingProvider`, swap that single import, add `stripePriceId` to each plan in `lib/billing/src/index.ts`. No route or UI changes needed.
- **Server gates**: `POST /api/projects` returns **402 `plan_limit_reached`** when Free hits its project limit. `POST /api/projects/:id/exports` returns **402 `feature_not_available`** for export formats not unlocked by the current plan.
- **Frontend**: `useBilling()` hook (`hooks/use-billing.ts`) for plan + gate checks. `<PlanBadge />` in the sidebar footer (links to `/pricing`). `pages/pricing.tsx` shows the four-tier comparison with one-click mock upgrade/cancel. Gated export cards in `pages/export.tsx` swap their CTA to a yellow "Upgrade to {Plan}" link to `/pricing`. The New Project page surfaces a yellow plan-limit banner + disabled submit button when at the Free cap.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
