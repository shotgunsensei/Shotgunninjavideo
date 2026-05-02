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

### Hardening (server)

`artifacts/api-server/src/app.ts` is wired with:

- `helmet` for default security headers (CSP off — API never serves HTML).
- `cors` — permissive in dev, locked to `ALLOWED_ORIGINS` (comma-separated) in prod.
- `express.json({ limit: "1mb" })` + matching urlencoded cap. The audio bytes never reach the server (they live in IndexedDB on the client) so 1 MB is plenty for metadata + analysis JSON.
- `express-rate-limit` at 300 req / 15 min per IP on `/api/*` (with `app.set("trust proxy", 1)` so the limiter keys by the real client IP behind the Replit proxy).
- A catch-all `/api` 404 handler followed by a centralized error middleware that maps `ZodError → 400`, `entity.too.large → 413`, CORS rejection → 403, and everything else → 500. In prod the message is sanitized; in dev the full message is returned. All errors are logged with request context via `req.log`.

### Admin / billing access control

- `artifacts/api-server/src/middleware/requireAdmin.ts` gates all `/api/admin/*` routes and the mutating billing routes (`POST /billing/upgrade`, `POST /billing/cancel`). In production the middleware refuses to start without `ADMIN_API_TOKEN` (returns 503), and rejects any request whose `X-Admin-Token` header doesn't match (401). In dev the gate soft-warns and allows through so iteration isn't blocked.
- `artifacts/api-server/src/lib/billingProvider.ts` throws at construction time when `BILLING_PROVIDER=stripe` in production but Stripe credentials are absent — no silent mock fallback. `index.ts` calls `getBillingProvider()` at boot so the failure surfaces during deploy rather than on the first paying-user request.

### Storyboard regen atomicity

`POST /api/projects/:id/storyboard` runs the full regen — scene mutations, project status bump, and activity row — inside a single `db.transaction(...)`. Both the `force=true` (full rebuild) and `force=false` (incremental, preserves locked scenes via `runIncrementalRegen` helper) branches flow through a shared tail that flips `projects.status` to `"storyboarded"` and inserts a `storyboard_generated` activity row. There is no early return inside the tx body — atomicity is required so the UI gating (`status === "storyboarded"`) never disagrees with actual scene rows.

Audio metadata uploads (`POST /api/projects/:id/audio`) additionally enforce a mime-type allowlist, the same 100 MB size cap as the client, a 255-char filename cap, and a project-existence check before any DB mutation.

### Graceful audio analysis fallback

`POST /api/projects/:id/analyze` accepts a Web-Audio-derived analysis payload from the browser, but if the body is empty (e.g. the IndexedDB cache was cleared, or the browser failed to decode the file), the server falls back to a deterministic mock analysis via `lib/mockAnalysis.ts → buildMockAnalysis`. The client's `analysis.tsx` triggers this fallback automatically when no cached blob is found and the catch block on the analyze flow marks the active stage as error and surfaces a toast. End result: the user is never blocked from progressing to the storyboard.

### Public marketing landing page

`/` (root) renders `artifacts/shotgun-ninjas/src/pages/home.tsx` — a full-bleed marketing site (no app sidebar; `Layout` strips it via `isLandingPage = location === "/"`). Eleven sections in order: fixed top nav → Hero → Problem → Solution → How it works (`#how-it-works`) → Demo preview → Feature grid (`#features`) → Pricing (`#pricing`, pulls real `PLAN_CATALOG`, "creator" marked Most Popular) → Example exports (10 formats with tier badges) → Creator workflow → FAQ (`#faq`, custom collapsible with `aria-controls`/`aria-expanded` + `role="region"`) → Final CTA → Footer.

Primary CTA "Start Your First Video Plan" → `/projects/new`. Secondary CTA "View Demo Project" is **dynamic** — `useDemoProjectHref()` calls `useListProjects()`, ranks by status (`exported > storyboarded > analyzed > uploaded > draft`), and links to the best one. Falls back to `/dashboard` if no projects exist (fresh DB on first deploy). Never hardcode a demo id here — the seed id can change between environments.

All section anchors use `scroll-mt-20` to offset the fixed nav. Mock storyboard waveform uses deterministic `Math.sin/cos` (not `Math.random`) so SSR / re-renders are stable.

## Documentation

`README.md` (project root) is the canonical onboarding doc. Update it whenever env vars, workflows, or setup steps change. `.env.example` lists every variable the project reads (`PORT`, `BASE_PATH`, `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV`, `ALLOWED_ORIGINS`, `BILLING_PROVIDER`, and the three reserved Stripe slots). On Replit, `PORT`, `BASE_PATH`, and `DATABASE_URL` are injected automatically per artifact — never hard-code them.

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