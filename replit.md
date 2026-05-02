# Overview

Shotgun Ninjas Video Engine is a DIY alternative to AI music video tools, designed to help users create beat-synced cinematic storyboards and production plans from their uploaded songs. The project aims to provide a comprehensive toolset for analyzing music, generating visual ideas, designing storylines, and exporting various production artifacts, empowering creators to produce high-quality music videos efficiently. The business vision is to democratize music video production, offering a powerful yet accessible platform for artists and content creators.

# User Preferences

I prefer iterative development and welcome questions about design choices or implementation details. Ask before making major changes or architectural decisions. I value clear and concise communication.

# System Architecture

The project is built as a monorepo using `pnpm workspaces`.

## Frontend

The frontend is a React application built with Vite, utilizing Tailwind CSS v4 for styling, shadcn/ui for UI components, `wouter` for routing, TanStack Query for data fetching, `framer-motion` for animations, and `recharts` for data visualization. The main user-facing application is located at `artifacts/shotgun-ninjas`. There is also a design canvas at `artifacts/mockup-sandbox`.

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

## Data Model Highlights

Key data entities include `projects`, `audio_files`, `analysis`, `timeline_segments`, `storyboard_scenes`, `lyric_lines`, `brand_presets`, `prompts`, `exports`, `activity`, `settings`, and `marketing_assets`.

# External Dependencies

-   **PostgreSQL**: Primary database for all application data.
-   **Orval**: Used for API codegen from an OpenAPI specification.
-   **AI Video Generation Platforms**: The system generates prompts compatible with platforms such as Runway, Pika, Kling, Luma, PixVerse, Stable Diffusion, Midjourney, Leonardo, CapCut, and DaVinci Resolve. (Note: The project generates prompts *for* these platforms, but does not directly integrate with their APIs for video generation within the current scope).
-   **Stripe (Future Integration)**: The billing system is designed with an abstraction layer to facilitate future integration with Stripe for payment processing.