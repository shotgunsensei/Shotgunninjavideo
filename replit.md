# Overview

Shotgun Ninjas Video Engine is a DIY alternative to AI music video tools, designed to help users create beat-synced cinematic storyboards and production plans from their uploaded songs. The project aims to provide a comprehensive toolset for analyzing music, generating visual ideas, designing storylines, and exporting various production artifacts, empowering creators to produce high-quality music videos efficiently. The business vision is to democratize music video production, offering a powerful yet accessible platform for artists and content creators.

# User Preferences

I prefer iterative development and welcome questions about design choices or implementation details. Ask before making major changes or architectural decisions. I value clear and concise communication.

# System Architecture

The project is built as a monorepo using `pnpm workspaces`.

## Frontend

The frontend is a React application built with Vite, utilizing Tailwind CSS v4 for styling, shadcn/ui for UI components, `wouter` for routing, TanStack Query for data fetching, `framer-motion` for animations, and `recharts` for data visualization. The main user-facing application is located at `artifacts/shotgun-ninjas`. There is also a design canvas at `artifacts/mockup-sandbox`.

### Design system

Premium dark "creator lab" aesthetic — pure black background with ambient crimson (HSL 320 100/50), purple (HSL 280 100/25), and pink-accent (HSL 340 100/50) radial gradients fixed to the viewport. Typography uses Space Grotesk (display) + JetBrains Mono (mono) with tight tracking on headings and uppercase tracking-widest on micro-copy. Custom utilities live in `artifacts/shotgun-ninjas/src/index.css`:

- **Gradients**: `bg-gradient-crimson`, `bg-gradient-crimson-soft`, `text-gradient-crimson`
- **Glows**: `shadow-glow-primary` / `accent` / `purple` / `soft`
- **Surfaces**: `surface-card` (semi-transparent layered card over body gradients)
- **Animations**: `animate-pulse-glow`, `animate-shimmer`, `ring-gradient-pulse` (conic spin), `hover-lift`

Shared layout components live in `artifacts/shotgun-ninjas/src/components/`:

- `PageHeader` — eyebrow + icon + title + subtitle + actions
- `EmptyState` — illustrated empty state with optional CTA
- `ProjectCompletionMeter` — animated progress bar + step pills (used on project hub)
- `StickyMobileBar` — fixed bottom-of-screen action bar for mobile (used on storyboard, export)

The sidebar uses `NavSection` + `NavItem` primitives with a left rail glow on the active item, accent dividers, and a brand mark with gradient. Dashboard, project hub, storyboard, export, and pricing all use these shared primitives, so any further visual polish should flow through `index.css` utilities and the shared components rather than inline overrides.

## Backend

The API server is built with Express 5 and located at `artifacts/api-server`. It powers all application features.

## Database

PostgreSQL is used as the database, with Drizzle ORM for database interactions. Data validation is handled by Zod.

## Core Features

-   **Audio Analysis**: Users upload a song, and the system performs a multi-stage "Deep Thinking" analysis to understand emotions, conceive visual ideas, and design a storyline. This includes BPM/key/energy/loudness analysis, segmenting by intensity and emotion, and generating an emotional map.
-   **Storyboard Generation**: Based on audio analysis and user input (optional lyrics, visual style, brand direction), the system generates a beat-synced cinematic storyboard with per-segment scene plans. Each scene includes shot type, camera, location, lighting, palette, wardrobe, and an AI prompt. Users can pick from 10 visual style presets.
-   **Lyric Integration**: Users can paste raw or timestamped lyrics, which are parsed and can be hand-assigned to scenes. Storyboard generation can be informed by these per-scene lyric snippets.
-   **Prompt Engine**: For each scene, a structured `PromptBlock` is generated, which is then rendered into 10 platform-specific AI video generation prompts (e.g., Runway, Pika, Luma).
-   **Export Center**: Provides various export formats including production plans, JSON, CSV shot lists, lyrics timing sheets, AI prompt packs, CapCut/DaVinci Resolve guides, client treatments, and social caption packs. Exports embed project metadata, analysis, timeline, storyboard, and prompts.
-   **Brand Presets**: Reusable visual identity packs with fields like brand name, character description, color palette, visual style, logo description, voice/tone, recurring symbols, camera language, negative prompt rules, and watermark text. These can be applied to projects or saved from project settings.
-   **Marketing Asset Pack**: Generates 13 ready-to-post marketing assets per project, categorized into Platform Copy, Social Captions, Cut-down Video Plans, Visual Asset Prompts, and Story Content.
-   **Local Render Planner**: Pure-frontend page (`/projects/:id/render-plan`, sidebar Hammer icon). Per-scene production walkthrough (recommended free/cheap image + video AI tool, prompt to paste, suggested clip duration with trim/split notes, transition into next scene, BPM-keyed editing note, song-section audio sync note) plus a 6-step recommended workflow (Generate images → Animate → Import to CapCut/DaVinci → Beat-align → Lyric overlays → Export) and a 6-group full render checklist. Logic lives in `artifacts/shotgun-ninjas/src/lib/renderPlanner.ts` (`buildRenderPlan` + `renderPlanToText`).
-   **Billing/Monetization**: Implements a tiered billing system (Free, Creator Pro, Studio Pro, Agency) with feature gates for projects and export formats.
-   **Admin / Debug Panel**: Top-level page (`/admin`, sidebar Bug icon). Lists every project sorted by quality, computes a 0–100 **Project Quality Score** from 7 weighted criteria (audio 15, timeline 15, storyboard 20, prompts 15, lyrics-or-theme 10, brand preset 10, exports 15) with letter grades A/B/C/D/F. Per-project drill-down: validation issues (missing fields, broken/overlapping/negative timestamps, locked scenes), JSON viewer with tabs for analysis/storyboard/prompts/lyrics/exports/marketing/all, and one-click test-export buttons that run any of the 10 builders without persisting (returns size + 800-char preview, or the error). Also surfaces global subscription gate state — current plan, project-limit usage, and per-format export gates. "Reset demo data" wipes & re-seeds the two built-in demo projects (custom projects untouched). Backend: `artifacts/api-server/src/routes/admin.ts` exposes `GET /api/admin/diagnostics`, `GET /api/admin/projects/:id/full`, `POST /api/admin/projects/:id/test-export/:format`, `POST /api/admin/reset-demo-data`.

## Data Model Highlights

Key data entities include `projects`, `audio_files`, `analysis`, `timeline_segments`, `storyboard_scenes`, `lyric_lines`, `brand_presets`, `prompts`, `exports`, `activity`, `settings`, and `marketing_assets`.

# External Dependencies

-   **PostgreSQL**: Primary database for all application data.
-   **Orval**: Used for API codegen from an OpenAPI specification.
-   **AI Video Generation Platforms**: The system generates prompts compatible with platforms such as Runway, Pika, Kling, Luma, PixVerse, Stable Diffusion, Midjourney, Leonardo, CapCut, and DaVinci Resolve. (Note: The project generates prompts *for* these platforms, but does not directly integrate with their APIs for video generation within the current scope).
-   **Stripe (Future Integration)**: The billing system is designed with an abstraction layer to facilitate future integration with Stripe for payment processing.