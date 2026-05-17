#!/usr/bin/env node

import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;

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
  console.log(`Usage:\n  node apps/api/scripts/delivery-status-webhook-replay-check.mjs [--api-base-url http://localhost:4000] [--channel doordash] [--event-id evt_123] [--external-order-id ext_123] [--internal-order-id order_123] [--correlation-id corr_123] [--webhook-secret secret] [--output-json ./artifacts/delivery-status-webhook-replay.json]\n\nEnv fallbacks:\n  API_BASE_URL\n  DELIVERY_CHANNEL\n  <CHANNEL>_WEBHOOK_SECRET\n  DELIVERY_WEBHOOK_SECRET`);
}

function makeSignature(rawBody, secret) {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

async function postWebhook({ apiBaseUrl, channel, payload, signature }) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/api/webhooks/delivery/${channel}/status`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-delivery-signature": `sha256=${signature}`
    },
    body: payload
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
    body
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    body: payload
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help === "true" || args.h === "true") {
    printUsage();
    process.exit(0);
  }

  const apiBaseUrl = args["api-base-url"] ?? process.env.API_BASE_URL ?? "http://localhost:4000";
  const channel = args.channel ?? process.env.DELIVERY_CHANNEL ?? "doordash";
  const eventId = args["event-id"] ?? `evt-delivery-status-${Date.now()}`;
  const correlationId = args["correlation-id"] ?? `corr-delivery-status-${channel}-${Date.now()}`;
  const outputJson = args["output-json"];

  const webhookSecret =
    args["webhook-secret"] ??
    process.env[`${channel.toUpperCase()}_WEBHOOK_SECRET`] ??
    process.env.DELIVERY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing webhook secret. Use --webhook-secret or CHANNEL_WEBHOOK_SECRET env var.");
    process.exit(1);
  }

  const createdOrder = await postJson(`${apiBaseUrl.replace(/\/$/, "")}/api/orders`, {
    customerEmail: `status+${Date.now()}@example.com`,
    source: channel,
    items: [
      {
        menuItemName: "Smoked Chicken Plate",
        quantity: 1,
        unitPriceCents: 2500
      }
    ],
    tipCents: 300,
    taxCents: 200
  });

  if (!createdOrder.ok || !createdOrder.body?.id) {
    console.error("Failed to create order for status replay", createdOrder);
    process.exit(2);
  }

  const internalOrderId = args["internal-order-id"] ?? createdOrder.body.id;
  const externalOrderId = args["external-order-id"] ?? `${channel}:${internalOrderId}`;

  const requestBody = {
    eventId,
    eventType: "order.status.updated",
    orderExternalId: externalOrderId,
    payload: {
      correlationId,
      statusUpdate: {
        internalOrderId,
        status: "ready"
      }
    }
  };

  const payload = JSON.stringify(requestBody);
  const signature = makeSignature(payload, webhookSecret);

  const first = await postWebhook({ apiBaseUrl, channel, payload, signature });
  const second = await postWebhook({ apiBaseUrl, channel, payload, signature });

  const result = {
    channel,
    eventId,
    correlationId,
    internalOrderId,
    externalOrderId,
    firstAttempt: first,
    secondAttempt: second,
    duplicateSuppressed: Boolean(second.body?.duplicate === true),
    correlation: {
      first: typeof first.body?.correlationId === "string" ? first.body.correlationId : null,
      second: typeof second.body?.correlationId === "string" ? second.body.correlationId : null,
      consistent:
        typeof first.body?.correlationId === "string" &&
        typeof second.body?.correlationId === "string" &&
        first.body.correlationId === second.body.correlationId
    }
  };

  if (typeof outputJson === "string" && outputJson.trim().length > 0) {
    const normalizedPath = outputJson.trim();
    await mkdir(dirname(normalizedPath), { recursive: true });
    await writeFile(normalizedPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(result, null, 2));

  if (!first.ok) process.exit(3);
  if (!second.ok) process.exit(4);
}

main().catch((error) => {
  console.error("delivery-status-webhook-replay-check failed", error);
  process.exit(99);
});
