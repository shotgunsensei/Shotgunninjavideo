import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { ZodError } from "zod";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const isProd = process.env["NODE_ENV"] === "production";

// We sit behind the Replit shared proxy in dev and behind the deployment
// load balancer in prod. Trust the first hop so req.ip / X-Forwarded-For
// are read correctly — without this express-rate-limit logs a warning
// and would key by the proxy IP instead of the real client.
app.set("trust proxy", 1);

// ── Structured request logging (never console.log) ─────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Security headers ───────────────────────────────────────────────────────
// Helmet ships sensible defaults: X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security (in prod), Referrer-Policy, etc. We disable CSP
// here because it's set at the static-host layer for the SPA — the API
// server itself never serves HTML.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ── CORS ───────────────────────────────────────────────────────────────────
// In development, allow everything so the Vite dev server and any embedded
// preview surfaces just work. In production, lock to an explicit allow-list
// from ALLOWED_ORIGINS (comma-separated). If unset in production, refuse all
// cross-origin requests to fail loud.
const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = isProd
  ? {
      origin(origin, callback) {
        // Same-origin requests have no Origin header — always allow.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));

// ── Body parsing with hard size caps ───────────────────────────────────────
// The audio file itself never reaches the server (it lives in IndexedDB on
// the client). Only metadata + analysis JSON ever flows through here, so
// 1 MB is generous. Reject anything larger before it can chew memory.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Per-IP rate limiting ───────────────────────────────────────────────────
// 300 req / 15 min is plenty for a single user driving the UI but blocks
// brute-force enumeration of project IDs.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});
app.use("/api", apiLimiter);

app.use("/api", router);

// ── 404 for unknown /api routes ────────────────────────────────────────────
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Centralized error handler ──────────────────────────────────────────────
// Express 5 forwards thrown/awaited errors here automatically. We surface
// Zod validation errors as 400, payload-too-large as 413, CORS as 403, and
// everything else as 500. In dev we include the message; in prod we log it
// and return a generic string so we don't leak internals.
app.use(
  (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    // Per Express 5 guidance: if a response has already started streaming we
    // must hand the error back to the default handler so the connection is
    // properly aborted. Trying to send another response would throw.
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof ZodError) {
      req.log?.warn({ issues: err.issues }, "Request validation failed");
      res.status(400).json({
        error: "Validation failed",
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }

    const e = err as { type?: string; status?: number; message?: string };

    if (e?.type === "entity.too.large") {
      res.status(413).json({ error: "Payload too large (max 1 MB)." });
      return;
    }

    if (typeof e?.message === "string" && e.message.includes("not allowed by CORS")) {
      res.status(403).json({ error: e.message });
      return;
    }

    req.log?.error({ err }, "Unhandled error in request");

    const status = typeof e?.status === "number" ? e.status : 500;
    res.status(status).json({
      error: isProd ? "Internal server error" : (e?.message ?? "Unknown error"),
    });
  },
);

export default app;
