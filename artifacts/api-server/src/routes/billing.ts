import { Router, type IRouter } from "express";
import { PLAN_CATALOG, PLAN_IDS, type PlanId } from "@workspace/billing";
import { UpgradeBillingPlanBody } from "@workspace/api-zod";
import {
  getBillingProvider,
  getProjectCount,
  snapshotToApi,
} from "../lib/billingProvider";
import { requireAdmin } from "../middleware/requireAdmin";

const router: IRouter = Router();

// ── Public reads (UI populates plan tiers + current state) ────────────────
router.get("/billing/plans", (_req, res) => {
  res.json(PLAN_IDS.map((id) => PLAN_CATALOG[id]));
});

router.get("/billing", async (_req, res) => {
  const [snap, count] = await Promise.all([
    getBillingProvider().getCurrent(),
    getProjectCount(),
  ]);
  res.json(snapshotToApi(snap, count));
});

// ── Mutations are gated behind ADMIN_API_TOKEN ─────────────────────────────
// In a single-tenant demo with no per-user auth, exposing /upgrade and
// /cancel publicly would let any visitor flip the workspace plan. The gate
// enforces a shared-secret header (mandatory in prod, soft-warn in dev).
router.post("/billing/upgrade", requireAdmin, async (req, res) => {
  const body = UpgradeBillingPlanBody.parse(req.body);
  const target = body.plan as PlanId;
  const snap = await getBillingProvider().changePlan(target);
  const count = await getProjectCount();
  res.json(snapshotToApi(snap, count));
});

router.post("/billing/cancel", requireAdmin, async (_req, res) => {
  const snap = await getBillingProvider().cancel();
  const count = await getProjectCount();
  res.json(snapshotToApi(snap, count));
});

export default router;
