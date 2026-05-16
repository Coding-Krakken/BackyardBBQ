#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import Stripe from "stripe";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) {
      continue;
    }

    const key = raw.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function printUsage() {
  console.log(`Usage:\n  node apps/api/scripts/stripe-dispute-replay-check.mjs --event-id evt_123 [--api-base-url http://localhost:4000] [--webhook-path /api/payments/webhook] [--disputes-path /api/admin/payments/disputes?limit=100] [--admin-role owner] [--output-json ./artifacts/dispute-replay.json] [--api-key sk_test_xxx] [--webhook-secret whsec_xxx]\n\nEnv fallbacks:\n  STRIPE_SECRET_KEY\n  STRIPE_WEBHOOK_SECRET\n  API_BASE_URL\n  WEBHOOK_PATH\n  DISPUTES_PATH\n  ADMIN_ROLE`);
}

async function postSignedWebhook({ apiBaseUrl, webhookPath, payload, signature }) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}${webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    body,
  };
}

async function getDisputes({ apiBaseUrl, disputesPath, adminRole }) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}${disputesPath.startsWith("/") ? disputesPath : `/${disputesPath}`}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-admin-role": adminRole,
    },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    body,
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help === "true" || args.h === "true") {
    printUsage();
    process.exit(0);
  }

  const eventId = args["event-id"];
  const apiKey = args["api-key"] ?? process.env.STRIPE_SECRET_KEY;
  const webhookSecret = args["webhook-secret"] ?? process.env.STRIPE_WEBHOOK_SECRET;
  const apiBaseUrl = args["api-base-url"] ?? process.env.API_BASE_URL ?? "http://localhost:4000";
  const webhookPath = args["webhook-path"] ?? process.env.WEBHOOK_PATH ?? "/api/payments/webhook";
  const disputesPath = args["disputes-path"] ?? process.env.DISPUTES_PATH ?? "/api/admin/payments/disputes?limit=100";
  const adminRole = args["admin-role"] ?? process.env.ADMIN_ROLE ?? "owner";
  const outputJson = args["output-json"];

  if (!eventId) {
    console.error("Missing required --event-id");
    printUsage();
    process.exit(1);
  }

  if (!apiKey) {
    console.error("Missing Stripe API key. Provide --api-key or STRIPE_SECRET_KEY.");
    process.exit(1);
  }

  if (!webhookSecret) {
    console.error("Missing webhook secret. Provide --webhook-secret or STRIPE_WEBHOOK_SECRET.");
    process.exit(1);
  }

  const stripe = new Stripe(apiKey);
  const event = await stripe.events.retrieve(eventId);

  if (!event.type.startsWith("charge.dispute.")) {
    console.error(`Event ${eventId} is type ${event.type}, expected charge.dispute.*`);
    process.exit(2);
  }

  const disputeObject = event.data.object;
  const disputeId = typeof disputeObject === "object" && disputeObject && "id" in disputeObject
    ? disputeObject.id
    : null;

  if (!disputeId || typeof disputeId !== "string") {
    console.error("Could not determine dispute ID from Stripe event payload.");
    process.exit(3);
  }

  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  const first = await postSignedWebhook({
    apiBaseUrl,
    webhookPath,
    payload,
    signature,
  });

  const second = await postSignedWebhook({
    apiBaseUrl,
    webhookPath,
    payload,
    signature,
  });

  const disputesResponse = await getDisputes({
    apiBaseUrl,
    disputesPath,
    adminRole,
  });

  const disputes = Array.isArray(disputesResponse.body?.data)
    ? disputesResponse.body.data
    : [];

  const matchedDispute = disputes.find((item) => item && item.disputeId === disputeId) ?? null;

  const result = {
    eventId,
    eventType: event.type,
    disputeId,
    firstAttempt: first,
    secondAttempt: second,
    duplicateSuppressed: Boolean(second.body && second.body.duplicate === true),
    disputesLookup: {
      status: disputesResponse.status,
      found: Boolean(matchedDispute),
      matchedDispute,
    },
  };

  if (typeof outputJson === "string" && outputJson.trim().length > 0) {
    const normalizedPath = outputJson.trim();
    await mkdir(dirname(normalizedPath), { recursive: true });
    await writeFile(normalizedPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(result, null, 2));

  if (!first.ok) {
    console.error("First replay failed.");
    process.exit(10);
  }

  if (!second.ok) {
    console.error("Second replay failed.");
    process.exit(11);
  }

  if (!disputesResponse.ok) {
    console.error("Disputes lookup failed.");
    process.exit(12);
  }

  if (!matchedDispute) {
    console.error("Dispute was not found in admin disputes API after replay.");
    process.exit(13);
  }
}

main().catch((error) => {
  console.error("stripe-dispute-replay-check failed", error);
  process.exit(99);
});
