import { Router, type IRouter } from "express";
import { PLAN_CATALOG, PLAN_IDS, type PlanId } from "@workspace/billing";
import { UpgradeBillingPlanBody } from "@workspace/api-zod";
import {
  getBillingProvider,
  getProjectCount,
  snapshotToApi,
} from "../lib/billingProvider";

const router: IRouter = Router();

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

router.post("/billing/upgrade", async (req, res) => {
  const body = UpgradeBillingPlanBody.parse(req.body);
  const target = body.plan as PlanId;
  const snap = await getBillingProvider().changePlan(target);
  const count = await getProjectCount();
  res.json(snapshotToApi(snap, count));
});

router.post("/billing/cancel", async (_req, res) => {
  const snap = await getBillingProvider().cancel();
  const count = await getProjectCount();
  res.json(snapshotToApi(snap, count));
});

export default router;
