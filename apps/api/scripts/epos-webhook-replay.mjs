#!/usr/bin/env node

import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const SUPPORTED_EVENT_TYPES = new Set([304, 305, 308, 309]);

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
  console.log(`Usage:\n  node apps/api/scripts/epos-webhook-replay.mjs [--event-id epos_evt_123] [--event-type 304] [--reference-code order_123] [--status-id 1] [--total-amount 41.5] [--api-base-url http://localhost:4000] [--webhook-path /api/payments/webhook] [--signature-header x-epos-signature] [--output-json ./artifacts/checkout-replay.json] [--webhook-secret secret]\n\nEnv fallbacks:\n  EPOS_NOW_WEBHOOK_SECRET\n  API_BASE_URL\n  WEBHOOK_PATH\n  EPOS_NOW_WEBHOOK_SIGNATURE_HEADER`);
}

function ensurePositiveFiniteNumber(value, flagName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${flagName}. Expected a positive number.`);
  }

  return parsed;
}

function ensureSupportedEventType(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || !SUPPORTED_EVENT_TYPES.has(parsed)) {
    throw new Error("Invalid --event-type. Expected one of: 304, 305, 308, 309.");
  }

  return parsed;
}

async function postSignedWebhook({ apiBaseUrl, webhookPath, payload, signatureHeader, signature }) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}${webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [signatureHeader]: `sha256=${signature}`,
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

async function main() {
  const args = parseArgs(process.argv);

  if (args.help === "true" || args.h === "true") {
    printUsage();
    process.exit(0);
  }

  const webhookSecret = args["webhook-secret"] ?? process.env.EPOS_NOW_WEBHOOK_SECRET;
  const apiBaseUrl = args["api-base-url"] ?? process.env.API_BASE_URL ?? "http://localhost:4000";
  const webhookPath = args["webhook-path"] ?? process.env.WEBHOOK_PATH ?? "/api/payments/webhook";
  const signatureHeader =
    (args["signature-header"] ?? process.env.EPOS_NOW_WEBHOOK_SIGNATURE_HEADER ?? "x-epos-signature")
      .trim()
      .toLowerCase();
  const eventId = (args["event-id"] ?? `epos_evt_${Date.now()}`).trim();
  const eventType = ensureSupportedEventType(args["event-type"] ?? "304");
  const referenceCode = (args["reference-code"] ?? "order_epos_replay").trim();
  const statusId = Number.isInteger(Number(args["status-id"])) ? Number(args["status-id"]) : 1;
  const totalAmount = ensurePositiveFiniteNumber(args["total-amount"] ?? "41.5", "--total-amount");
  const outputJson = args["output-json"];

  if (!eventId) {
    console.error("Invalid --event-id. Value cannot be empty.");
    process.exit(1);
  }

  if (!webhookSecret) {
    console.error("Missing webhook secret. Provide --webhook-secret or EPOS_NOW_WEBHOOK_SECRET.");
    process.exit(1);
  }

  const payloadObject = {
    eventId,
    eventType,
    referenceCode,
    statusId,
    totalAmount,
  };

  const payload = JSON.stringify(payloadObject);
  const signature = createHmac("sha256", webhookSecret).update(payload, "utf8").digest("hex");

  const first = await postSignedWebhook({
    apiBaseUrl,
    webhookPath,
    payload,
    signatureHeader,
    signature,
  });

  const second = await postSignedWebhook({
    apiBaseUrl,
    webhookPath,
    payload,
    signatureHeader,
    signature,
  });

  const result = {
    provider: "epos",
    eventId,
    eventType,
    referenceCode,
    firstAttempt: first,
    secondAttempt: second,
    duplicateSuppressed: Boolean(second.body && second.body.duplicate === true),
  };

  if (typeof outputJson === "string" && outputJson.trim().length > 0) {
    const normalizedPath = outputJson.trim();
    await mkdir(dirname(normalizedPath), { recursive: true });
    await writeFile(normalizedPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(result, null, 2));

  if (!first.ok) {
    console.error("First replay failed.");
    process.exit(2);
  }

  if (!second.ok) {
    console.error("Second replay failed.");
    process.exit(3);
  }
}

main().catch((error) => {
  console.error("epos-webhook-replay failed", error);
  process.exit(99);
});
