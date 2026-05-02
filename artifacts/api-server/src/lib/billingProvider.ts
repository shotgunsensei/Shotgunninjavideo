import { eq } from "drizzle-orm";
import { db, billingTable, projectsTable, type Billing } from "@workspace/db";
import {
  PLAN_CATALOG,
  PLAN_IDS,
  type PlanId,
  type SubscriptionStatus,
  type Feature,
} from "@workspace/billing";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// Provider-agnostic shape returned to routes. The mock provider below and a
// future StripeBillingProvider both produce this. Routes only ever talk to
// the provider, never to the DB directly, so swapping providers later is a
// one-line change in `getBillingProvider()` below.
export interface BillingSnapshot {
  plan: PlanId;
  status: SubscriptionStatus;
  features: Feature[];
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: Date;
  providerName: "mock" | "stripe";
}

export interface BillingProvider {
  readonly name: "mock" | "stripe";
  /** Read the current subscription, creating a default Free row if missing. */
  getCurrent(): Promise<BillingSnapshot>;
  /** Switch to a different plan. In Stripe this calls Subscriptions API; in
   *  mock mode it just updates the local row. */
  changePlan(target: PlanId): Promise<BillingSnapshot>;
  /** Cancel and revert to Free immediately (mock) or at period end (Stripe).
   *  In mock mode we cancel immediately and reset to Free for simplicity. */
  cancel(): Promise<BillingSnapshot>;
}

function isPlanId(s: string): s is PlanId {
  return (PLAN_IDS as readonly string[]).includes(s);
}
function isStatus(s: string): s is SubscriptionStatus {
  return (
    s === "active" || s === "trialing" || s === "past_due" || s === "cancelled"
  );
}

function rowToSnapshot(row: Billing, providerName: "mock" | "stripe"): BillingSnapshot {
  const plan: PlanId = isPlanId(row.plan) ? row.plan : "free";
  const status: SubscriptionStatus = isStatus(row.status) ? row.status : "active";
  return {
    plan,
    status,
    features: PLAN_CATALOG[plan].features,
    currentPeriodStart: row.currentPeriodStart ?? null,
    currentPeriodEnd: row.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === 1,
    updatedAt: row.updatedAt,
    providerName,
  };
}

async function ensureBillingRow(): Promise<Billing> {
  const [existing] = await db.select().from(billingTable).where(eq(billingTable.id, 1));
  if (existing) return existing;
  const [created] = await db
    .insert(billingTable)
    .values({ id: 1, plan: "free", status: "active" })
    .returning();
  if (!created) throw new Error("Failed to create billing row");
  logger.info("Initialized billing row with default Free plan");
  return created;
}

class MockBillingProvider implements BillingProvider {
  readonly name = "mock" as const;

  async getCurrent(): Promise<BillingSnapshot> {
    const row = await ensureBillingRow();
    return rowToSnapshot(row, this.name);
  }

  async changePlan(target: PlanId): Promise<BillingSnapshot> {
    await ensureBillingRow();
    // Mock period: every "paid" plan gets a synthetic 30-day window so the UI
    // has something to show. Free clears the period entirely.
    const now = new Date();
    const periodEnd =
      target === "free" ? null : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const periodStart = target === "free" ? null : now;

    const [updated] = await db
      .update(billingTable)
      .set({
        plan: target,
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: 0,
        updatedAt: now,
      })
      .where(eq(billingTable.id, 1))
      .returning();
    if (!updated) throw new Error("Failed to update billing row");
    logger.info({ plan: target }, "[mock-billing] Plan changed");
    return rowToSnapshot(updated, this.name);
  }

  async cancel(): Promise<BillingSnapshot> {
    return this.changePlan("free");
  }
}

let provider: BillingProvider | null = null;

/** Returns the active billing provider. Reads BILLING_PROVIDER from the env;
 *  when unset (or "mock"), uses the in-DB mock. The Stripe variant lands in a
 *  later PR — when it does, swap the import here, no other code changes. */
export function getBillingProvider(): BillingProvider {
  if (provider) return provider;
  const flag = (process.env.BILLING_PROVIDER ?? "mock").toLowerCase();
  if (flag === "stripe") {
    // Future: provider = new StripeBillingProvider({ apiKey: process.env.STRIPE_SECRET_KEY! })
    logger.warn("BILLING_PROVIDER=stripe set but Stripe provider is not implemented yet; falling back to mock.");
  }
  provider = new MockBillingProvider();
  return provider;
}

/** Counts current projects for the demo workspace. With auth this becomes
 *  per-user; for now there's a single workspace. */
export async function getProjectCount(): Promise<number> {
  const [{ c } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(projectsTable);
  return c ?? 0;
}

export function snapshotToApi(snap: BillingSnapshot, projectCount: number) {
  const meta = PLAN_CATALOG[snap.plan];
  return {
    plan: snap.plan,
    status: snap.status,
    planMeta: meta,
    features: snap.features,
    usage: {
      projectCount,
      projectLimit: meta.projectLimit,
    },
    providerName: snap.providerName,
    currentPeriodStart: snap.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: snap.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
    updatedAt: snap.updatedAt.toISOString(),
  };
}
