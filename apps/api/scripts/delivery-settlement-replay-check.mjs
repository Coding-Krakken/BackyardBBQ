#!/usr/bin/env node

import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  console.log(`Usage:\n  node apps/api/scripts/delivery-settlement-replay-check.mjs [--api-base-url http://localhost:4000] [--admin-base-url http://localhost:3001] [--channel doordash] [--event-id evt_123] [--external-order-id order_123] [--correlation-id corr_123] [--webhook-secret secret] [--webhook-token token] [--date 2026-05-16] [--output-json ./artifacts/delivery-settlement-replay.json]\n\nEnv fallbacks:\n  API_BASE_URL\n  ADMIN_BASE_URL\n  DELIVERY_CHANNEL\n  <CHANNEL>_WEBHOOK_SECRET\n  DELIVERY_WEBHOOK_SECRET\n  <CHANNEL>_SETTLEMENTS_WEBHOOK_TOKEN\n  DELIVERY_WEBHOOK_TOKEN`);
}

function makeSignature(rawBody, secret) {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

async function postWebhook({ apiBaseUrl, channel, payload, signature, webhookToken }) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/api/webhooks/delivery/${channel}/settlements`;
  const headers = {
    "content-type": "application/json",
    "x-delivery-signature": `sha256=${signature}`
  };

  if (typeof webhookToken === "string" && webhookToken.length > 0) {
    headers.authorization = `Bearer ${webhookToken}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
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

async function getDailyClose({ apiBaseUrl, date }) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/admin/accounting/daily-close${query}`, {
    headers: {
      "x-admin-role": "owner"
    }
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

async function getSettlementEvents({ adminBaseUrl, channel, correlationId }) {
  const query = new URLSearchParams({
    channel,
    correlationId,
    limit: "50"
  });

  try {
    const response = await fetch(
      `${adminBaseUrl.replace(/\/$/, "")}/api/admin/integrations/settlements?${query.toString()}`,
      {
        headers: {
          "x-admin-role": "owner"
        }
      }
    );

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
  } catch (error) {
    return {
      status: null,
      ok: false,
      body: {
        error: error instanceof Error ? error.message : "Unknown fetch error"
      }
    };
  }
}

async function findLedgerLinkFromIntegrationEvents({ channel, correlationId, settlementId }) {
  const recentEvents = await prisma.integrationEvent.findMany({
    where: {
      channel,
      eventType: "delivery.webhook.settlement.received"
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 200,
    select: {
      id: true,
      status: true,
      payload: true
    }
  });

  for (const event of recentEvents) {
    const payload = event.payload;
    if (!payload || typeof payload !== "object") {
      continue;
    }

    const record = payload;
    const eventCorrelationId = typeof record.correlationId === "string" ? record.correlationId : null;
    const eventSettlementId =
      typeof record.settlementId === "string"
        ? record.settlementId
        : typeof record.settlement === "object" && record.settlement && typeof record.settlement.settlementId === "string"
          ? record.settlement.settlementId
          : null;
    const settlementBatchId =
      typeof record.settlementBatchId === "string" && record.settlementBatchId.length > 0
        ? record.settlementBatchId
        : null;
    const settlementLineId =
      typeof record.settlementLineId === "string" && record.settlementLineId.length > 0
        ? record.settlementLineId
        : null;

    if (
      event.status === "processed" &&
      eventCorrelationId === correlationId &&
      eventSettlementId === settlementId &&
      settlementBatchId &&
      settlementLineId
    ) {
      return {
        observed: true,
        eventId: event.id,
        settlementBatchId,
        settlementLineId
      };
    }
  }

  return {
    observed: false,
    eventId: null,
    settlementBatchId: null,
    settlementLineId: null
  };
}

async function waitForSettlementLedgerLink({
  adminBaseUrl,
  channel,
  correlationId,
  settlementId,
  maxAttempts = 15,
  delayMs = 1000
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const snapshot = await getSettlementEvents({ adminBaseUrl, channel, correlationId });
    const rows = Array.isArray(snapshot.body?.data) ? snapshot.body.data : [];

    const matching = rows.find(
      (row) =>
        row &&
        row.status === "processed" &&
        row.settlementId === settlementId &&
        typeof row.settlementBatchId === "string" &&
        row.settlementBatchId.length > 0 &&
        typeof row.settlementLineId === "string" &&
        row.settlementLineId.length > 0
    );

    if (matching) {
      return {
        observed: true,
        attempts: attempt,
        settlementsApiStatus: snapshot.status,
        settlementsApiOk: snapshot.ok,
        eventId: typeof matching.id === "string" ? matching.id : null,
        settlementBatchId: matching.settlementBatchId,
        settlementLineId: matching.settlementLineId
      };
    }

    // Local fallback: if admin endpoint is unavailable/auth-protected, verify ledger linkage directly via DB.
    const dbFallback = await findLedgerLinkFromIntegrationEvents({ channel, correlationId, settlementId });
    if (dbFallback.observed) {
      return {
        observed: true,
        attempts: attempt,
        settlementsApiStatus: snapshot.status,
        settlementsApiOk: snapshot.ok,
        eventId: dbFallback.eventId,
        settlementBatchId: dbFallback.settlementBatchId,
        settlementLineId: dbFallback.settlementLineId
      };
    }

    if (attempt < maxAttempts) {
      await delay(delayMs);
    }
  }

  return {
    observed: false,
    attempts: maxAttempts,
    settlementsApiStatus: null,
    settlementsApiOk: false,
    eventId: null,
    settlementBatchId: null,
    settlementLineId: null
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help === "true" || args.h === "true") {
    printUsage();
    process.exit(0);
  }

  const apiBaseUrl = args["api-base-url"] ?? process.env.API_BASE_URL ?? "http://localhost:4000";
  const adminBaseUrl = args["admin-base-url"] ?? process.env.ADMIN_BASE_URL ?? apiBaseUrl;
  const channel = args.channel ?? process.env.DELIVERY_CHANNEL ?? "doordash";
  const externalOrderId = args["external-order-id"] ?? `settlement-${Date.now()}`;
  const eventId = args["event-id"] ?? `evt-settlement-${Date.now()}`;
  const correlationId = args["correlation-id"] ?? `corr-delivery-settlement-${channel}-${Date.now()}`;
  const date = args.date;
  const outputJson = args["output-json"];
  const webhookSecret =
    args["webhook-secret"] ??
    process.env[`${channel.toUpperCase()}_WEBHOOK_SECRET`] ??
    process.env.DELIVERY_WEBHOOK_SECRET;
  const webhookToken =
    args["webhook-token"] ??
    process.env[`${channel.toUpperCase()}_SETTLEMENTS_WEBHOOK_TOKEN`] ??
    process.env.DELIVERY_WEBHOOK_TOKEN;

  if (!webhookSecret) {
    console.error("Missing webhook secret. Use --webhook-secret or CHANNEL_WEBHOOK_SECRET env var.");
    process.exit(1);
  }

  const requestBody = {
    eventId,
    eventType: "settlement.created",
    orderExternalId: externalOrderId,
    payload: {
      correlationId,
      settlement: {
        settlementId: `stl-${Date.now()}`,
        payoutId: `po-${Date.now()}`,
        externalOrderId,
        grossCents: 4600,
        feesCents: 690,
        netCents: 3910,
        currency: "usd",
        settledAt: new Date().toISOString()
      }
    }
  };

  const businessKeyReplayBody = {
    ...requestBody,
    eventId: `${eventId}-bizkey-replay`,
    payload: {
      correlationId,
      settlement: {
        ...requestBody.payload.settlement
      }
    }
  };

  const payload = JSON.stringify(requestBody);
  const signature = makeSignature(payload, webhookSecret);
  const businessKeyPayload = JSON.stringify(businessKeyReplayBody);
  const businessKeySignature = makeSignature(businessKeyPayload, webhookSecret);

  const first = await postWebhook({ apiBaseUrl, channel, payload, signature, webhookToken });
  const second = await postWebhook({ apiBaseUrl, channel, payload, signature, webhookToken });
  const thirdBusinessKeyReplay = await postWebhook({
    apiBaseUrl,
    channel,
    payload: businessKeyPayload,
    signature: businessKeySignature,
    webhookToken
  });
  const dailyClose = await getDailyClose({ apiBaseUrl, date });
  const ledgerSync = await waitForSettlementLedgerLink({
    adminBaseUrl,
    channel,
    correlationId,
    settlementId: requestBody.payload.settlement.settlementId
  });

  const settlementByChannel = Array.isArray(dailyClose.body?.settlementByChannel)
    ? dailyClose.body.settlementByChannel
    : [];
  const channelSettlement = settlementByChannel.find((row) => row?.channel === channel) ?? null;

  const result = {
    channel,
    eventId,
    correlationId,
    externalOrderId,
    settlementId: requestBody.payload.settlement.settlementId,
    firstAttempt: first,
    secondAttempt: second,
    thirdBusinessKeyReplay,
    duplicateSuppressed: Boolean(second.body?.duplicate === true),
    businessKeyDuplicateSuppressed:
      Boolean(thirdBusinessKeyReplay.body?.duplicate === true) &&
      (thirdBusinessKeyReplay.body?.duplicateType === "settlement" ||
        thirdBusinessKeyReplay.body?.settlementId === requestBody.payload.settlement.settlementId),
    correlation: {
      first: typeof first.body?.correlationId === "string" ? first.body.correlationId : null,
      second: typeof second.body?.correlationId === "string" ? second.body.correlationId : null,
      third: typeof thirdBusinessKeyReplay.body?.correlationId === "string" ? thirdBusinessKeyReplay.body.correlationId : null,
      consistent:
        typeof first.body?.correlationId === "string" &&
        typeof second.body?.correlationId === "string" &&
        typeof thirdBusinessKeyReplay.body?.correlationId === "string" &&
        first.body.correlationId === second.body.correlationId &&
        second.body.correlationId === thirdBusinessKeyReplay.body.correlationId
    },
    dailyClose: {
      ok: dailyClose.ok,
      settlementNetCents:
        typeof dailyClose.body?.summary?.settlementNetCents === "number"
          ? dailyClose.body.summary.settlementNetCents
          : null,
      channelSettlement
    },
    ledgerSync
  };

  if (typeof outputJson === "string" && outputJson.trim().length > 0) {
    const normalizedPath = outputJson.trim();
    await mkdir(dirname(normalizedPath), { recursive: true });
    await writeFile(normalizedPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(result, null, 2));

  if (!first.ok) process.exit(2);
  if (!second.ok) process.exit(3);
  if (!thirdBusinessKeyReplay.ok) process.exit(4);
  if (!dailyClose.ok) process.exit(5);
  if (!ledgerSync.observed) process.exit(6);
}

main().catch((error) => {
  console.error("delivery-settlement-replay-check failed", error);
  process.exit(99);
}).finally(async () => {
  await prisma.$disconnect();
});
