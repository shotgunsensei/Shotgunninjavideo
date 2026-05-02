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
- `prompts` — AI video generation prompt per scene (model, text, negative prompt, aspect ratio, duration)
- `exports` — generated JSON / TXT / production_plan exports
- `activity` — recent activity feed
- `settings` — single-row global settings (default model, aspect ratio, scene duration, theme, creator info)

## Workflow

Upload song → "Deep Thinking" analysis (5 stages: Song analysis / Understanding emotions / Conceiving visual ideas / Storyline design / Content preview) → **(optional) Lyrics**: paste raw or `[mm:ss.cs]` / `[hh:mm:ss]` timestamped lyrics, parse, hand-assign untimed lines to scenes, then "Improve Storyboard" to regenerate unlocked scenes informed by per-scene lyric snippets → generate storyboard → generate scene prompts → export JSON/TXT/production plan.

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

A demo project ("Black Velvet Static" by RONIN/X) is seeded on first server start so the dashboard is never empty.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
