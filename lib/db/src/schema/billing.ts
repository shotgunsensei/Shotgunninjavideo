import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

// Single-row "current subscription" table. Demo mode uses a mock provider that
// just toggles the `plan` column. The Stripe-related columns are stubs so we
// can swap to a real provider later without a destructive migration.
export const billingTable = pgTable("billing", {
  id: integer("id").primaryKey().default(1),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  // Future Stripe wiring — null in demo mode.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: integer("cancel_at_period_end").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Billing = typeof billingTable.$inferSelect;
export type InsertBilling = typeof billingTable.$inferInsert;
