import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const scriptPath = join(process.cwd(), "scripts", "payments-integration-checks.mjs");

function runChecks(args, env = {}) {
  return spawnSync("node", [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

test("prints usage with --help", () => {
  const result = runChecks(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /Environment requirements:/);
});

test("fails fast when Stripe env vars are missing", () => {
  const result = runChecks([
    "--checkout-event-id",
    "evt_checkout_1",
    "--dispute-event-id",
    "evt_dispute_1",
  ], {
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required environment variable: STRIPE_SECRET_KEY/);
});

test("fails on invalid admin role before running integration commands", () => {
  const result = runChecks([
    "--checkout-event-id",
    "evt_checkout_1",
    "--dispute-event-id",
    "evt_dispute_1",
    "--admin-role",
    "superadmin",
  ], {
    STRIPE_SECRET_KEY: "sk_test_dummy",
    STRIPE_WEBHOOK_SECRET: "whsec_dummy",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid --admin-role/);
});

test("fails on invalid event id format", () => {
  const result = runChecks([
    "--checkout-event-id",
    "bad_event",
    "--dispute-event-id",
    "evt_dispute_1",
  ], {
    STRIPE_SECRET_KEY: "sk_test_dummy",
    STRIPE_WEBHOOK_SECRET: "whsec_dummy",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid --checkout-event-id/);
});
