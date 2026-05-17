#!/usr/bin/env node

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
  console.log(`Usage:\n  node apps/api/scripts/delivery-action-replay-check.mjs [--api-base-url http://localhost:4000] [--channel doordash] [--action accept] [--reason \"manual override\"] [--correlation-id corr_123] [--output-json ./artifacts/delivery-action-replay.json]\n\nEnv fallbacks:\n  API_BASE_URL`);
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
  const channel = args.channel ?? "doordash";
  const action = args.action ?? "accept";
  const reason = args.reason ?? "manual_action_replay";
  const correlationId = args["correlation-id"] ?? `corr-delivery-action-${channel}-${Date.now()}`;
  const outputJson = args["output-json"];

  const createOrder = await postJson(`${apiBaseUrl.replace(/\/$/, "")}/api/orders`, {
    customerEmail: `action+${Date.now()}@example.com`,
    source: channel,
    items: [
      {
        menuItemName: "Smoked Chicken Plate",
        quantity: 1,
        unitPriceCents: 2200
      }
    ],
    tipCents: 300,
    taxCents: 176
  });

  if (!createOrder.ok || !createOrder.body?.id) {
    console.error("Failed to create order", createOrder);
    process.exit(2);
  }

  const orderId = createOrder.body.id;

  const firstAction = await postJson(`${apiBaseUrl.replace(/\/$/, "")}/api/delivery/orders/${orderId}/action`, {
    channel,
    action,
    reason,
    correlationId
  });

  const secondAction = await postJson(`${apiBaseUrl.replace(/\/$/, "")}/api/delivery/orders/${orderId}/action`, {
    channel,
    action,
    reason,
    correlationId
  });

  const result = {
    orderId,
    channel,
    action,
    requestedCorrelationId: correlationId,
    correlationId:
      typeof firstAction.body?.correlationId === "string"
        ? firstAction.body.correlationId
        : typeof secondAction.body?.correlationId === "string"
          ? secondAction.body.correlationId
          : null,
    firstAction,
    secondAction,
    duplicateSuppressed: Boolean(secondAction.body?.duplicate === true),
    correlation: {
      first: typeof firstAction.body?.correlationId === "string" ? firstAction.body.correlationId : null,
      second: typeof secondAction.body?.correlationId === "string" ? secondAction.body.correlationId : null,
      consistent:
        typeof firstAction.body?.correlationId === "string" &&
        typeof secondAction.body?.correlationId === "string" &&
        firstAction.body.correlationId === secondAction.body.correlationId
    }
  };

  if (typeof outputJson === "string" && outputJson.trim().length > 0) {
    const normalizedPath = outputJson.trim();
    await mkdir(dirname(normalizedPath), { recursive: true });
    await writeFile(normalizedPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(result, null, 2));

  if (!firstAction.ok) process.exit(3);
  if (!secondAction.ok) process.exit(4);
}

main().catch((error) => {
  console.error("delivery-action-replay-check failed", error);
  process.exit(99);
});
