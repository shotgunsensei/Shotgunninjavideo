import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./lib/seed";
import { getBillingProvider } from "./lib/billingProvider";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Fail fast in production if CORS is unconfigured. Without ALLOWED_ORIGINS the
// strict prod CORS policy in app.ts would reject every cross-origin request,
// which is a footgun if someone deploys without realizing the requirement.
if (process.env["NODE_ENV"] === "production") {
  const origins = (process.env["ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error(
      "ALLOWED_ORIGINS must be set in production (comma-separated list of allowed origins).",
    );
  }
}

// Boot-time validation of billing provider config. Without this, a
// production deploy with BILLING_PROVIDER=stripe but missing Stripe creds
// would only surface its misconfiguration on the first /billing/upgrade
// call (i.e. the first paying user would see a 500). Calling the factory
// here forces the throw to happen at process start so the deploy fails
// loudly instead of silently shipping broken billing.
getBillingProvider();

await seedIfEmpty();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
