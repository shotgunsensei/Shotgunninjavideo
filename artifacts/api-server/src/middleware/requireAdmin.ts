import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const isProd = process.env["NODE_ENV"] === "production";

let warnedDevOpen = false;

/**
 * Gate sensitive routes (admin diagnostics, billing mutations) behind a
 * shared-secret header. The token is read from `ADMIN_API_TOKEN`.
 *
 * Behavior:
 *   - In production:  token MUST be set AND request header must match,
 *                     otherwise return 401 / 503.
 *   - In development: if the token is unset, requests are allowed (with
 *                     a single warn log so it's obvious in dev). If it
 *                     IS set, it's enforced just like prod so devs can
 *                     test the gate locally.
 *
 * Header: `X-Admin-Token: <secret>`
 *
 * This is a single-tenant demo with no per-user auth; this guard exists
 * specifically to keep public deployments from exposing admin/billing
 * endpoints to arbitrary internet traffic.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env["ADMIN_API_TOKEN"];

  if (!expected) {
    if (isProd) {
      req.log?.error(
        { path: req.path },
        "Admin route hit but ADMIN_API_TOKEN is not configured — refusing.",
      );
      res.status(503).json({
        error: "admin_not_configured",
        detail: "ADMIN_API_TOKEN env var must be set in production.",
      });
      return;
    }
    if (!warnedDevOpen) {
      logger.warn(
        "ADMIN_API_TOKEN unset — admin/billing-mutation routes are OPEN in dev. Set the env var to test the gate.",
      );
      warnedDevOpen = true;
    }
    next();
    return;
  }

  const provided = req.header("x-admin-token");
  if (provided !== expected) {
    req.log?.warn({ path: req.path }, "Admin route auth failed");
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}
