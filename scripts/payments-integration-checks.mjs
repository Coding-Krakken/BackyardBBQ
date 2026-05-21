#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const SUPPORTED_PROVIDERS = new Set(["stripe", "epos"]);

function parseArgs(argv) {
  const args = {};

  for (let index = 2; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith("--")) {
      continue;
    }

    const key = raw.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function printUsage() {
  console.log(`Usage:\n  node scripts/payments-integration-checks.mjs [--provider stripe|epos] [--checkout-event-id evt_123] [--dispute-event-id evt_456] [--checkout-event-type 304] [--checkout-reference-code order_123] [--checkout-status-id 1] [--checkout-total-amount 41.5] [--api-base-url https://backyard-bbq-backend.vercel.app] [--webhook-path /api/payments/webhook] [--disputes-path /api/admin/payments/disputes?limit=100] [--admin-role owner] [--output-dir artifacts/payments-replay]\n\nProvider-specific environment requirements:\n  stripe -> STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET\n  epos   -> EPOS_NOW_WEBHOOK_SECRET`);
}

function normalizeProvider(value) {
  const provider = (value ?? "stripe").trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error("Invalid --provider. Expected one of: stripe, epos.");
  }

  return provider;
}

function ensureNonEmptyEnvVar(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function ensureEventId(value, flagName) {
  if (!value) {
    throw new Error(`Missing required ${flagName}`);
  }

  if (!value.startsWith("evt_")) {
    throw new Error(`Invalid ${flagName}. Expected a Stripe event id starting with evt_.`);
  }
}

function ensureSupportedEposEventType(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || ![304, 305, 308, 309].includes(parsed)) {
    throw new Error("Invalid --checkout-event-type. Expected one of: 304, 305, 308, 309.");
  }
}

function ensurePositiveNumber(value, flagName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${flagName}. Expected a positive number.`);
  }
}

function ensureAbsoluteHttpUrl(value, flagName) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error(`Invalid ${flagName}. Provide an absolute http(s) URL.`);
  }
}

function ensureRoutePath(value, flagName) {
  if (!value.startsWith("/")) {
    throw new Error(`Invalid ${flagName}. Route paths must start with '/'.`);
  }
}

function ensureAdminRole(value) {
  const allowed = new Set(["owner", "admin", "accounting"]);
  if (!allowed.has(value)) {
    throw new Error("Invalid --admin-role. Expected one of: owner, admin, accounting.");
  }
}

function ensureOutputDir(value) {
  if (!value.trim()) {
    throw new Error("Invalid --output-dir. Value cannot be empty.");
  }
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (typeof result.status === "number") {
    return result.status;
  }

  return 1;
}

function main() {
  const args = parseArgs(process.argv);

  if (args.help === "true" || args.h === "true") {
    printUsage();
    process.exit(0);
  }

  const provider = normalizeProvider(args.provider ?? process.env.PAYMENT_PROVIDER ?? "stripe");
  const checkoutEventId = args["checkout-event-id"];
  const disputeEventId = args["dispute-event-id"];
  const checkoutEventType = args["checkout-event-type"] ?? "304";
  const checkoutReferenceCode = args["checkout-reference-code"] ?? "order_integration_replay";
  const checkoutStatusId = args["checkout-status-id"] ?? "1";
  const checkoutTotalAmount = args["checkout-total-amount"] ?? "41.5";

  const apiBaseUrl = args["api-base-url"] ?? "http://localhost:4000";
  const webhookPath = args["webhook-path"] ?? "/api/payments/webhook";
  const disputesPath = args["disputes-path"] ?? "/api/admin/payments/disputes?limit=100";
  const adminRole = args["admin-role"] ?? "owner";
  const outputDir = args["output-dir"] ?? `artifacts/${provider}-replay`;

  try {
    if (provider === "stripe") {
      ensureNonEmptyEnvVar("STRIPE_SECRET_KEY");
      ensureNonEmptyEnvVar("STRIPE_WEBHOOK_SECRET");
      ensureEventId(checkoutEventId, "--checkout-event-id");
      ensureEventId(disputeEventId, "--dispute-event-id");
    } else {
      ensureNonEmptyEnvVar("EPOS_NOW_WEBHOOK_SECRET");
      ensureSupportedEposEventType(checkoutEventType);
      ensurePositiveNumber(checkoutStatusId, "--checkout-status-id");
      ensurePositiveNumber(checkoutTotalAmount, "--checkout-total-amount");
      if (!checkoutReferenceCode.trim()) {
        throw new Error("Invalid --checkout-reference-code. Value cannot be empty.");
      }
    }

    ensureAbsoluteHttpUrl(apiBaseUrl, "--api-base-url");
    ensureRoutePath(webhookPath, "--webhook-path");
    if (provider === "stripe") {
      ensureRoutePath(disputesPath, "--disputes-path");
    }
    ensureAdminRole(adminRole);
    ensureOutputDir(outputDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid replay integration input.";
    console.error(message);
    printUsage();
    process.exit(1);
  }

  const checkoutOutput = `${outputDir}/checkout-replay.json`;
  const disputeOutput = `${outputDir}/dispute-replay.json`;

  const checkoutReplayCommand =
    provider === "stripe"
      ? [
          "run",
          "test:stripe:webhook-replay",
          "--",
          "--event-id",
          checkoutEventId,
          "--api-base-url",
          apiBaseUrl,
          "--webhook-path",
          webhookPath,
          "--output-json",
          checkoutOutput,
        ]
      : [
          "run",
          "test:epos:webhook-replay",
          "--",
          "--event-type",
          String(checkoutEventType),
          "--reference-code",
          checkoutReferenceCode,
          "--status-id",
          String(checkoutStatusId),
          "--total-amount",
          String(checkoutTotalAmount),
          "--api-base-url",
          apiBaseUrl,
          "--webhook-path",
          webhookPath,
          "--output-json",
          checkoutOutput,
        ];

  const checkoutExit = runCommand("npm", checkoutReplayCommand);

  if (checkoutExit !== 0) {
    process.exit(checkoutExit);
  }

  if (provider === "epos") {
    process.exit(0);
  }

  const disputeExit = runCommand("npm", [
    "run",
    "test:stripe:dispute-replay",
    "--",
    "--event-id",
    disputeEventId,
    "--api-base-url",
    apiBaseUrl,
    "--webhook-path",
    webhookPath,
    "--disputes-path",
    disputesPath,
    "--admin-role",
    adminRole,
    "--output-json",
    disputeOutput,
  ]);

  process.exit(disputeExit);
}

main();
