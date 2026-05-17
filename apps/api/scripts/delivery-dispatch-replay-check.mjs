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
  console.log(`Usage:\n  node apps/api/scripts/delivery-dispatch-replay-check.mjs [--api-base-url http://localhost:4000] [--channel doordash] [--correlation-id corr_123] [--output-json ./artifacts/delivery-dispatch-replay.json]\n\nEnv fallbacks:\n  API_BASE_URL`);
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
  const correlationId = args["correlation-id"] ?? `corr-delivery-dispatch-${channel}-${Date.now()}`;
  const outputJson = args["output-json"];

  const createOrder = await postJson(`${apiBaseUrl.replace(/\/$/, "")}/api/orders`, {
    customerEmail: `dispatch+${Date.now()}@example.com`,
    source: channel,
    items: [
      {
        menuItemName: "Pulled Pork Plate",
        quantity: 1,
        unitPriceCents: 2400
      }
    ],
    tipCents: 300,
    taxCents: 192
  });

  if (!createOrder.ok || !createOrder.body?.id) {
    console.error("Failed to create order", createOrder);
    process.exit(2);
  }

  const orderId = createOrder.body.id;

  const firstDispatch = await postJson(`${apiBaseUrl.replace(/\/$/, "")}/api/delivery/dispatch`, {
    orderId,
    channel,
    priority: "normal",
    correlationId
  });

  const secondDispatch = await postJson(`${apiBaseUrl.replace(/\/$/, "")}/api/delivery/dispatch`, {
    orderId,
    channel,
    priority: "normal",
    correlationId
  });

  const result = {
    orderId,
    channel,
    requestedCorrelationId: correlationId,
    correlationId:
      typeof firstDispatch.body?.correlationId === "string"
        ? firstDispatch.body.correlationId
        : typeof secondDispatch.body?.correlationId === "string"
          ? secondDispatch.body.correlationId
          : null,
    firstDispatch,
    secondDispatch,
    duplicateSuppressed: Boolean(secondDispatch.body?.duplicate === true),
    correlation: {
      first: typeof firstDispatch.body?.correlationId === "string" ? firstDispatch.body.correlationId : null,
      second: typeof secondDispatch.body?.correlationId === "string" ? secondDispatch.body.correlationId : null,
      consistent:
        typeof firstDispatch.body?.correlationId === "string" &&
        typeof secondDispatch.body?.correlationId === "string" &&
        firstDispatch.body.correlationId === secondDispatch.body.correlationId
    }
  };

  if (typeof outputJson === "string" && outputJson.trim().length > 0) {
    const normalizedPath = outputJson.trim();
    await mkdir(dirname(normalizedPath), { recursive: true });
    await writeFile(normalizedPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(result, null, 2));

  if (!firstDispatch.ok) process.exit(3);
  if (!secondDispatch.ok) process.exit(4);
}

main().catch((error) => {
  console.error("delivery-dispatch-replay-check failed", error);
  process.exit(99);
});
