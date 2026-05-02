# Shotgun Ninjas Video Engine

A beat-synced cinematic storyboard generator. Drop a track in, get a multi-stage
"deep thinking" pass that decodes the audio in your browser, extracts BPM, key,
structural sections, and an emotional arc, then turns the whole thing into a
locked-frame storyboard with cover art prompts, scene-by-scene direction,
exportable shot lists, and marketing assets.

This is a **pnpm monorepo** containing three artifacts:

| Artifact | Path | What it is |
| --- | --- | --- |
| `shotgun-ninjas` | `artifacts/shotgun-ninjas` | Vite + React 19 + Tailwind v4 web app |
| `api-server` | `artifacts/api-server` | Express 5 + Drizzle + Postgres API |
| `mockup-sandbox` | `artifacts/mockup-sandbox` | Internal component preview server |

---

## Table of contents

1. [What the app does](#what-the-app-does)
2. [Tech stack](#tech-stack)
3. [Repository layout](#repository-layout)
4. [Quick start (Replit)](#quick-start-replit)
5. [Quick start (local)](#quick-start-local)
6. [Environment variables](#environment-variables)
7. [Database setup](#database-setup)
8. [Stripe setup](#stripe-setup)
9. [Development commands](#development-commands)
10. [Production deployment](#production-deployment)
11. [Security notes](#security-notes)
12. [Known limitations](#known-limitations)
13. [Roadmap](#roadmap)

---

## What the app does

The user follows a five-stage pipeline:

1. **Project setup** — name, artist, genre, brand direction, optional preset.
2. **Source injection** — drag-and-drop a master audio file (MP3/WAV/M4A/FLAC/OGG, ≤100 MB). The file is cached in **IndexedDB on the client** — it never leaves the browser. Only metadata (filename, mime type, size, duration) is registered with the server.
3. **Acoustic soul extraction** — five-stage browser-side analysis using the Web Audio API:
   - Decode + downmix to mono
   - 100 ms RMS energy envelope
   - BPM via autocorrelation of onset envelopes
   - Beat-onset localization
   - Musical key estimation (Krumhansl–Schmuckler)
   - Section detection via novelty curves
   - Valence × arousal emotional mapping
   When decoding fails (no cached audio, unsupported codec, etc.) the server falls back to a deterministic **mock analyzer** so the user is never blocked.
4. **Storyboard** — beat-snapped scenes with locked seeds, palette, lensing, pacing, lyrics overlays, and a Director's Direction prompt.
5. **Export** — production plan + shot lists, prompt bundles for Veo / Sora / Runway / Pika, social cuts, edit decision lists, and a marketing asset bundle (cover, IG carousel, TikTok thumb, YouTube end-card).

Two demo projects are seeded automatically on first boot so the UI is never empty.

---

## Tech stack

**Frontend**
- React 19 + Vite 7
- TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui
- TanStack Query v5 (data fetching, generated hooks via Orval)
- wouter (routing)
- framer-motion (animations, gated behind `prefers-reduced-motion`)
- Recharts (analysis visualizations)
- IndexedDB via a thin custom wrapper (`audioStorage.ts`)
- Web Audio API for native audio analysis (no FFmpeg, no native deps)

**Backend**
- Node 20+ ESM
- Express 5
- Drizzle ORM + Postgres
- Zod schemas shared via `@workspace/api-zod` (single source of truth)
- OpenAPI spec → typed React Query hooks via Orval
- pino + pino-http (structured logging — never `console.log`)
- helmet + express-rate-limit for hardening
- esbuild bundler

**Infra / tooling**
- pnpm workspaces (catalog + composite TS project refs)
- Replit Workflows for process management
- Built-in Postgres on Replit
- Stripe (optional — `MockBillingProvider` is the default until you wire keys)

---

## Repository layout

```
artifacts/
  api-server/        # Express API
  shotgun-ninjas/    # The web app
  mockup-sandbox/    # Internal component preview
lib/
  api-spec/          # OpenAPI source of truth + Orval config
  api-zod/           # Generated Zod schemas (do not edit by hand)
  api-client-react/  # Generated React Query hooks (do not edit by hand)
  billing/           # Plan catalog + provider interface
  db/                # Drizzle schema + migrations + client
scripts/             # Shared utility scripts
.env.example         # Copy to .env for local dev
replit.md            # Architecture / decisions log (kept up to date)
```

See `.local/skills/pnpm-workspace/SKILL.md` for the full convention reference.

---

## Quick start (Replit)

The project is **preconfigured for Replit** — the three workflows below are
already registered and will start automatically when the Repl loads:

| Workflow | Command |
| --- | --- |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` |
| `artifacts/shotgun-ninjas: web` | `pnpm --filter @workspace/shotgun-ninjas run dev` |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` |

To run the app:

1. Fork the Repl (or open it in your account).
2. The Postgres integration is already wired — `DATABASE_URL` is injected for you.
3. The first boot calls `seedIfEmpty()` which provisions schema + two demo projects.
4. Open the preview pane and pick **Shotgun Ninjas Video Engine** from the artifact dropdown.

That's it. No extra setup needed for the core flow.

---

## Quick start (local)

Prerequisites: **Node 20+**, **pnpm 9+**, **PostgreSQL 14+**.

```bash
# 1. Install deps (workspace-aware)
pnpm install

# 2. Copy env template and fill in DATABASE_URL + SESSION_SECRET
cp .env.example .env
$EDITOR .env

# 3. Push the Drizzle schema to your local Postgres
pnpm --filter @workspace/db run push

# 4. Run the API server (terminal 1)
PORT=8080 pnpm --filter @workspace/api-server run dev

# 5. Run the web app (terminal 2). BASE_PATH is required — it controls the
#    Vite `base` so links work behind the Replit proxy. Use "/" locally.
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/shotgun-ninjas run dev

# 6. (Optional) Run the component preview sandbox (terminal 3)
PORT=8081 BASE_PATH=/__mockup pnpm --filter @workspace/mockup-sandbox run dev
```

Visit `http://localhost:5173`. The web app proxies `/api/*` to the API server.

> **Important:** Do not run `pnpm dev` at the workspace root — there is no
> root `dev` script by design. Always target a specific package via
> `--filter`. Both Vite apps will throw at startup if `PORT` or `BASE_PATH`
> is missing — this is intentional. See `.local/skills/pnpm-workspace/SKILL.md`
> for the rationale.

---

## Environment variables

All variables are documented inline in [`.env.example`](./.env.example). Summary:

| Name | Required | Used by | Notes |
| --- | --- | --- | --- |
| `PORT` | ✅ | api-server, web, sandbox | Injected automatically by Replit workflows. Each artifact gets its own port. |
| `BASE_PATH` | ✅ | web, sandbox | Vite `base` URL for the artifact. Replit injects it; for local dev set `/` for the web app and `/__mockup` for the sandbox. The Vite configs throw at startup if missing. |
| `DATABASE_URL` | ✅ | api-server, db migrations | Provided by Replit Postgres integration. |
| `SESSION_SECRET` | ✅ (prod) | api-server | 32+ byte random string for cookie signing. |
| `NODE_ENV` | ⚪ | api-server | `development` (default) or `production`. |
| `ALLOWED_ORIGINS` | ⚪ | api-server | Comma-separated CORS allowlist for production. |
| `BILLING_PROVIDER` | ⚪ | api-server (billing) | `mock` (default) or `stripe`. The `stripe` value is reserved — see [Stripe setup](#stripe-setup) below for the current state. |
| `STRIPE_SECRET_KEY` | ⚪ | api-server (billing) | Reserved for the future Stripe provider. |
| `STRIPE_WEBHOOK_SECRET` | ⚪ | api-server (billing) | Reserved for the future Stripe provider. |
| `VITE_STRIPE_PUBLIC_KEY` | ⚪ | web (billing) | Reserved for the future Stripe provider. |

**Never commit a real `.env`.** The `.gitignore` covers `node_modules` and
`.cache/`; treat secrets as Replit Secrets (or your platform's secret store)
in any deployed environment.

---

## Database setup

The app uses **PostgreSQL via Drizzle ORM**. Schema lives in
`lib/db/src/schema/` and the client is exported from `lib/db/src/index.ts`.

```bash
# Push schema changes to dev Postgres (idempotent)
pnpm --filter @workspace/db run push

# Force-push when the diff is destructive (drops/renames). Use carefully.
pnpm --filter @workspace/db run push-force
```

**On Replit**, the schema is pushed for you on first boot via the
`seedIfEmpty()` call in `artifacts/api-server/src/index.ts`, which also seeds
two demo projects so the UI isn't empty.

**For production**, run `pnpm --filter @workspace/db run push` against your
production `DATABASE_URL` once before the first deploy, then again after any
schema change. See `.local/skills/database/SKILL.md` for the safe production
push flow.

---

## Stripe setup

Billing is **mocked by default**. The provider is selected by the
`BILLING_PROVIDER` env var, read in
`artifacts/api-server/src/lib/billingProvider.ts → getBillingProvider()`:

- `BILLING_PROVIDER=mock` (or unset) — uses `MockBillingProvider`, which keeps
  the current plan in the `billing` table and simulates plan changes locally.
  The pricing page is fully wired against this and works out of the box.
- `BILLING_PROVIDER=stripe` — **reserved**. The Stripe provider class is
  not yet implemented; setting this value today will log a warning and fall
  back to mock. The Stripe-related env vars (`STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLIC_KEY`) are documented in
  `.env.example` so the slots are reserved for when the real provider lands.

When you're ready to wire real Stripe billing, the integration steps will be:

1. Create a Stripe account + product/price IDs for each paid plan
   (Creator Pro, Studio Pro, Agency) and put the price IDs into
   `lib/billing/src/index.ts`.
2. Implement `StripeBillingProvider` next to `MockBillingProvider` in
   `billingProvider.ts` and wire it inside `getBillingProvider()` when
   `BILLING_PROVIDER=stripe`.
3. Set the three Stripe env vars in production (Replit Secrets).
4. Point a webhook at `POST /api/billing/webhook` for
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`. For local testing:
   ```bash
   stripe listen --forward-to localhost:8080/api/billing/webhook
   ```

The Replit Stripe MCP is available now for read/write Stripe API calls
without writing custom server code — see `.local/mcp_skills/stripe/SKILL.md`.

---

## Development commands

All commands run from the **repo root** unless noted.

```bash
# Type-check everything (libs first, then artifacts)
pnpm run typecheck

# Type-check just the libs
pnpm run typecheck:libs

# Build everything for production
pnpm run build

# Restart a single workflow (Replit)
# Use the Replit workflow tool — do NOT shell out to pnpm dev.

# Regenerate API client + Zod schemas after changing the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes
pnpm --filter @workspace/db run push

# Filter any other script to a single workspace
pnpm --filter @workspace/<package-name> run <script>
```

---

## Production deployment

The recommended path is **Replit Deployments**:

1. Verify the app boots cleanly: open the Repl, watch all three workflows
   reach a healthy state, then exercise the dashboard → upload → analysis →
   storyboard → export flow at least once.
2. Push your production database schema:
   ```bash
   DATABASE_URL=$PROD_DATABASE_URL pnpm --filter @workspace/db run push
   ```
3. Confirm `SESSION_SECRET` is set in production (Replit Secrets).
4. Set `NODE_ENV=production` and `ALLOWED_ORIGINS=https://your-domain` to
   lock down CORS.
5. Hit **Deploy** in the Replit workspace. Replit handles HTTPS, health
   checks, and the build step automatically.

Health endpoint for external monitors: `GET /api/healthz` → `{ "status": "ok" }`.

---

## Security notes

This app is hardened with the basics — review and extend before handling real
user data.

**What's enabled**

- **Helmet** sets sensible default response headers (XSS, MIME-sniff,
  referrer-policy, frame-options).
- **Rate limiting** (`express-rate-limit`) caps each IP at **300 requests
  per 15 minutes** for `/api/*`. Tune in `app.ts` if you have heavy users.
- **Body size limit** of **1 MB** on `express.json()` — the audio file
  itself never hits the server (it lives in IndexedDB), so 1 MB is more than
  enough for metadata + analysis payloads.
- **Strict CORS in production**: when `NODE_ENV=production`, only origins
  listed in `ALLOWED_ORIGINS` are allowed. In development, all origins are
  accepted to make local iteration painless.
- **Zod validation** on every API input via shared `@workspace/api-zod` schemas.
  Bad payloads get a 400 with a sanitized error.
- **Centralized error middleware** catches thrown errors, logs them with
  request context via pino, and returns a generic 500 in production (full
  message + stack only in development).
- **MIME allowlist on audio metadata** — the server rejects any
  `mimeType` outside the supported audio set even though the file bytes
  never reach it (defense in depth: prevents poisoned metadata from
  showing up downstream in exports).
- **Per-IP rate limit** (above) blocks brute-force enumeration of project IDs.
  The server sets `app.set('trust proxy', 1)` so the limiter keys by the real
  client IP rather than the upstream proxy.
- **Supply-chain defense**: pnpm `minimumReleaseAge: 1440` requires every
  package to be at least 24 hours old before install (see `pnpm-workspace.yaml`).

**What's deliberately out of scope (for now)**

- No authentication / multi-tenant isolation. All projects are world-readable
  given a project ID. **Do not deploy this publicly until you wire auth** —
  use the Replit Auth or Clerk skills to add it.
- No CSRF token on mutating routes (would matter once auth is added).
- No virus scanning of uploaded audio (lower risk because bytes stay
  client-side, but worth adding if you ever start uploading to S3).
- No PII in logs by design — but audit pino redaction config before going live.

---

## Known limitations

- **Audio never leaves the browser.** That's a feature for privacy but means
  you can't re-analyze on a different device — clearing IndexedDB requires
  re-uploading the master file.
- **Web Audio API decoding** depends on the browser's codec support. Some
  exotic formats (e.g. some AAC variants in Firefox) may fail to decode; the
  server's mock analyzer kicks in as a graceful fallback so the storyboard
  still generates.
- **100 MB upload cap.** Imposed client-side to keep IndexedDB writes
  reasonable across browsers. Loosening it requires testing on Safari (which
  has the tightest IndexedDB quotas).
- **No real video rendering yet** — the engine produces a *plan* (prompts,
  shot lists, EDLs) for downstream tools (Veo, Sora, Runway, Pika). Actual
  video synthesis is on the roadmap.
- **Single-user / no auth.** See the security notes above.
- **Stripe is mocked by default.** The pricing page is fully wired but the
  default `MockBillingProvider` doesn't talk to Stripe.
- **Mockup sandbox** is an internal preview surface, not user-facing.

---

## Roadmap

- [ ] Authentication (Replit Auth or Clerk) + per-user project isolation
- [ ] Real video rendering pipeline (Veo / Runway / Pika integrations)
- [ ] Cloud audio storage (opt-in) for cross-device projects
- [ ] Collaborative editing — share-link + presence
- [ ] Mobile app (Expo, sharing the same OpenAPI client)
- [ ] Stripe webhooks fully wired (subscription lifecycle, dunning)
- [ ] Background job queue for long-running export bundles
- [ ] Audio source-separation (drums / vocals / bass stems) for finer-grained scene cuts
- [ ] Auto-generated B-roll from text prompts using the integrated providers
- [ ] Versioned storyboard history with diff view

---

## License

Proprietary — internal Replit project. Contact the team before redistributing.
