import Fastify from "fastify";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma, Prisma } from "./prisma.js";
import {
  isPersistedDuplicateIntegrationEvent
} from "./webhook/persisted-dedupe.js";
import { createWebhookSharedState } from "./webhook/shared-state.js";
import { handleEposWebhook } from "./webhook/epos-handler.js";
import { buildRefundEventFilter, parseRefundAmountCents } from "./accounting/refunds.js";
import {
  getRequestIps,
  isWebhookIpAllowed,
  resolveRequestCorrelationId,
  verifyHmacSha256Signature
} from "./webhook/security.js";
import { buildPaymentMetricsSnapshot as buildPaymentMetricsSnapshotQuery } from "./metrics/paymentSnapshot.js";
import { getPaymentProvider, unsupportedProviderMessage } from "./payment-provider.js";
import type { PaymentStatus } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
  }
}

const deliveryChannels: Record<string, { orders?: string; status?: string; settlements?: string }> = {
  doordash: {
    orders: process.env.DOORDASH_WEBHOOK_ORDERS,
    status: process.env.DOORDASH_WEBHOOK_STATUS,
    settlements: process.env.DOORDASH_WEBHOOK_SETTLEMENTS,
  },
  ubereats: {
    orders: process.env.UBEREATS_WEBHOOK_ORDERS,
    status: process.env.UBEREATS_WEBHOOK_STATUS,
    settlements: process.env.UBEREATS_WEBHOOK_SETTLEMENTS,
  },
  grubhub: {
    orders: process.env.GRUBHUB_WEBHOOK_ORDERS,
    status: process.env.GRUBHUB_WEBHOOK_STATUS,
    settlements: process.env.GRUBHUB_WEBHOOK_SETTLEMENTS,
  },
};

export async function buildApp() {

const app = Fastify({ logger: true });
const paymentProvider = getPaymentProvider();
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const paymentAlertWebhookUrl = process.env.PAYMENT_ALERT_WEBHOOK_URL?.trim() || undefined;
const disputeRateThresholdPercent = Number(process.env.DISPUTE_RATE_ALERT_THRESHOLD ?? "2");
const refundRateThresholdPercent = Number(process.env.REFUND_RATE_ALERT_THRESHOLD ?? "5");
const alertCooldownMs = Number(process.env.PAYMENT_ALERT_COOLDOWN_MS ?? String(1000 * 60 * 30));
const lastAlertByType = new Map<string, number>();
const webhookRateLimit = Number(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE ?? "100");
const webhookRateWindowMs = 60 * 1000;
const webhookEventTtlMs = Number(process.env.WEBHOOK_EVENT_TTL_MS ?? String(24 * 60 * 60 * 1000));
const settlementIdempotencyWindowMs = Number(
  process.env.DELIVERY_SETTLEMENT_IDEMPOTENCY_WINDOW_MS ?? String(7 * 24 * 60 * 60 * 1000)
);
const eposWebhookAllowedIps = (process.env.EPOS_NOW_WEBHOOK_ALLOWED_IPS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const eposWebhookSecret = process.env.EPOS_NOW_WEBHOOK_SECRET?.trim();
const eposWebhookSignatureHeader =
  process.env.EPOS_NOW_WEBHOOK_SIGNATURE_HEADER?.trim().toLowerCase() || "x-epos-signature";
const eposWebhookRequireSignature =
  (process.env.EPOS_NOW_WEBHOOK_REQUIRE_SIGNATURE ?? "true").trim().toLowerCase() !== "false";
const metricsApiKey = process.env.METRICS_API_KEY?.trim() || "";
const webhookSharedState = createWebhookSharedState({
  onFallbackError: ({ op, error }) => {
    app.log.error(
      { error, op },
      "Webhook shared-state backend failed; falling back to in-memory behavior"
    );
  }
});

app.addHook("onClose", async () => {
  await webhookSharedState.close();
});

app.addHook("onRequest", async (request, reply) => {
  const correlationId = resolveRequestCorrelationId(request.headers, randomUUID);
  request.correlationId = correlationId;
  reply.header("X-Correlation-ID", correlationId);
});

async function isWebhookRateLimited(ip: string) {
  const key = ip || "unknown";
  return webhookSharedState.isRateLimited(key, webhookRateLimit, webhookRateWindowMs);
}

async function isDuplicateWebhookEvent(eventId: string, now = Date.now()) {
  return webhookSharedState.checkDuplicate(eventId, webhookEventTtlMs, now);
}

async function isDuplicateEposWebhookEventInDatabase(input: {
  eventId: string;
  eventTypeName: string;
}) {
  return isPersistedDuplicateIntegrationEvent({
    hasDatabaseUrl,
    integrationEvent: prisma.integrationEvent,
    channel: "epos",
    eventType: `epos.webhook.${input.eventTypeName}`,
    eventId: input.eventId,
    webhookEventTtlMs
  });
}

async function sendOperationalAlert(input: {
  type: string;
  severity: "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
}) {
  const lastAlertAt = lastAlertByType.get(input.type) ?? 0;
  const now = Date.now();
  if (now - lastAlertAt < alertCooldownMs) {
    return;
  }

  lastAlertByType.set(input.type, now);

  app.log.warn(
    {
      alertType: input.type,
      severity: input.severity,
      ...(input.details ?? {})
    },
    input.message
  );

  if (!paymentAlertWebhookUrl) {
    return;
  }

  try {
    await fetch(paymentAlertWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "backyard-bbq-api",
        type: input.type,
        severity: input.severity,
        message: input.message,
        details: input.details ?? {},
        sentAt: new Date().toISOString()
      })
    });
  } catch (error) {
    app.log.error({ error, alertType: input.type }, "Failed to deliver payment alert webhook");
  }
}

async function evaluateRiskThresholds(trigger: string) {
  if (!hasDatabaseUrl) {
    return;
  }

  const windowStart = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

  const [transactionCount, disputeCount, refundedAmount, totalSettledAmount] = await Promise.all([
    prisma.paymentTransaction.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.integrationEvent.count({
      where: {
        OR: [
          {
            channel: "stripe",
            eventType: { contains: "charge.dispute" },
          },
          {
            channel: "epos",
            eventType: { contains: "dispute" },
          },
        ],
        createdAt: { gte: windowStart }
      }
    }),
    prisma.paymentTransaction.aggregate({
      where: {
        createdAt: { gte: windowStart },
        status: { in: ["refunded", "partially_refunded"] }
      },
      _sum: { amountCents: true }
    }),
    prisma.paymentTransaction.aggregate({
      where: {
        createdAt: { gte: windowStart },
        status: { in: ["succeeded", "refunded", "partially_refunded"] }
      },
      _sum: { amountCents: true }
    })
  ]);

  const disputeRate = transactionCount > 0 ? (disputeCount / transactionCount) * 100 : 0;
  const refundedCents = refundedAmount._sum.amountCents ?? 0;
  const settledCents = totalSettledAmount._sum.amountCents ?? 0;
  const refundRate = settledCents > 0 ? (refundedCents / settledCents) * 100 : 0;

  if (disputeRate > disputeRateThresholdPercent) {
    await sendOperationalAlert({
      type: "high_dispute_rate",
      severity: "critical",
      message: "Dispute rate exceeded threshold",
      details: {
        trigger,
        disputeRate,
        thresholdPercent: disputeRateThresholdPercent,
        disputeCount,
        transactionCount,
        windowDays: 30
      }
    });
  }

  if (refundRate > refundRateThresholdPercent) {
    await sendOperationalAlert({
      type: "high_refund_rate",
      severity: "warning",
      message: "Refund rate exceeded threshold",
      details: {
        trigger,
        refundRate,
        thresholdPercent: refundRateThresholdPercent,
        refundedCents,
        settledCents,
        windowDays: 30
      }
    });
  }
}

async function buildPaymentMetricsSnapshot(days: number) {
  return buildPaymentMetricsSnapshotQuery({
    days,
    hasDatabaseUrl,
    prisma
  });
}

function toPrometheusMetrics(snapshot: {
  windowDays: number;
  kpis: {
    totalTransactions: number;
    successfulTransactions: number;
    refundedTransactions: number;
    settledVolumeCents: number;
    refundedVolumeCents: number;
    disputeCount: number;
    successRate: number;
    refundRate: number;
    disputeRate: number;
    averagePaymentCents: number;
    webhookEvents: number;
    averageWebhookLatencyMs: number;
  };
}) {
  const lines = [
    `bbq_payments_total_transactions{window_days="${snapshot.windowDays}"} ${snapshot.kpis.totalTransactions}`,
    `bbq_payments_successful_transactions{window_days="${snapshot.windowDays}"} ${snapshot.kpis.successfulTransactions}`,
    `bbq_payments_refunded_transactions{window_days="${snapshot.windowDays}"} ${snapshot.kpis.refundedTransactions}`,
    `bbq_payments_settled_volume_cents{window_days="${snapshot.windowDays}"} ${snapshot.kpis.settledVolumeCents}`,
    `bbq_payments_refunded_volume_cents{window_days="${snapshot.windowDays}"} ${snapshot.kpis.refundedVolumeCents}`,
    `bbq_payments_dispute_count{window_days="${snapshot.windowDays}"} ${snapshot.kpis.disputeCount}`,
    `bbq_payments_success_rate_percent{window_days="${snapshot.windowDays}"} ${snapshot.kpis.successRate}`,
    `bbq_payments_refund_rate_percent{window_days="${snapshot.windowDays}"} ${snapshot.kpis.refundRate}`,
    `bbq_payments_dispute_rate_percent{window_days="${snapshot.windowDays}"} ${snapshot.kpis.disputeRate}`,
    `bbq_payments_average_payment_cents{window_days="${snapshot.windowDays}"} ${snapshot.kpis.averagePaymentCents}`,
    `bbq_payments_webhook_events{window_days="${snapshot.windowDays}"} ${snapshot.kpis.webhookEvents}`,
    `bbq_payments_average_webhook_latency_ms{window_days="${snapshot.windowDays}"} ${snapshot.kpis.averageWebhookLatencyMs}`
  ];

  return `${lines.join("\n")}\n`;
}

await app.register(cors, {
  origin: true
});

await app.register(rawBody, {
  global: false,
  field: "rawBody",
  encoding: "utf8",
  runFirst: true
});

app.get("/health", async () => ({ status: "ok", service: "api" }));

app.get("/api/payments/health", async () => ({
  paymentProvider,
  databaseConfigured: hasDatabaseUrl
}));

app.get("/api/health/webhook", async () => {
  const sharedStateHealth = await webhookSharedState.health();

  if (!hasDatabaseUrl) {
    return {
      status: "unknown",
      databaseConfigured: false,
      lastWebhookAt: null,
      dedupeBackend: sharedStateHealth.backend,
      rateLimitBackend: sharedStateHealth.backend,
      sharedStateFallbackActive: sharedStateHealth.fallbackActive,
      redisConnected: sharedStateHealth.redisConnected
    };
  }

  const latestWebhook = await prisma.integrationEvent.findFirst({
    where: { channel: paymentProvider },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      eventType: true,
      status: true
    }
  });

  return {
    status: latestWebhook ? "ok" : "idle",
    databaseConfigured: true,
    dedupeBackend: sharedStateHealth.backend,
    rateLimitBackend: sharedStateHealth.backend,
    sharedStateFallbackActive: sharedStateHealth.fallbackActive,
    redisConnected: sharedStateHealth.redisConnected,
    lastWebhookAt: latestWebhook?.createdAt.toISOString() ?? null,
    lastEventType: latestWebhook?.eventType ?? null,
    lastEventStatus: latestWebhook?.status ?? null
  };
});

app.get("/api/health/delivery/:channel", async (request, reply) => {
  const parsedParams = deliveryWebhookParamsSchema.safeParse(request.params);
  if (!parsedParams.success) {
    return reply.status(400).send({
      message: "Invalid delivery channel",
      errors: parsedParams.error.flatten()
    });
  }

  if (!hasDatabaseUrl) {
    return {
      channel: parsedParams.data.channel,
      status: "unknown",
      databaseConfigured: false,
      lastEventAt: null
    };
  }

  const channel = parsedParams.data.channel;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events = await prisma.integrationEvent.findMany({
    where: {
      channel,
      createdAt: { gte: since }
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      status: true,
      createdAt: true
    }
  });

  const failedCount = events.filter((event) => event.status === "failed").length;
  const deadLetterCount = events.filter((event) => event.status === "dead_letter").length;
  const processedCount = events.filter((event) => event.status === "processed").length;
  const total = events.length;
  const failureRate = total > 0 ? (failedCount + deadLetterCount) / total : 0;
  const status = failureRate >= 0.5 ? "down" : failureRate > 0 ? "degraded" : "healthy";

  return {
    channel,
    status,
    windowHours: 24,
    counts: {
      total,
      processed: processedCount,
      failed: failedCount,
      deadLetter: deadLetterCount
    },
    failureRate,
    lastEventAt: events[0]?.createdAt.toISOString() ?? null
  };
});

app.get("/api/metrics/payments", async (request, reply) => {
  const querySchema = z.object({
    days: z.coerce.number().int().min(1).max(90).default(30),
    format: z.enum(["json", "prometheus"]).default("json")
  });

  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid metrics query",
      errors: parsed.error.flatten()
    });
  }

  if (metricsApiKey) {
    const headerKey = typeof request.headers["x-metrics-key"] === "string" ? request.headers["x-metrics-key"] : "";
    if (!headerKey || headerKey !== metricsApiKey) {
      return reply.status(401).send({ message: "Unauthorized metrics access" });
    }
  }

  const snapshot = await buildPaymentMetricsSnapshot(parsed.data.days);

  if (parsed.data.format === "prometheus") {
    reply.type("text/plain; version=0.0.4; charset=utf-8");
    return toPrometheusMetrics(snapshot);
  }

  return snapshot;
});

const orderSourceSchema = z.enum(["direct", "doordash", "ubereats", "grubhub", "catering"]);

const createOrderSchema = z.object({
  customerEmail: z.string().email().optional(),
  locationId: z.string().optional(),
  source: orderSourceSchema.default("direct"),
  items: z
    .array(
      z.object({
        menuItemName: z.string().min(1),
        quantity: z.number().int().min(1),
        unitPriceCents: z.number().int().min(1),
        notes: z.string().optional()
      })
    )
    .min(1),
  tipCents: z.number().int().min(0).default(0),
  taxCents: z.number().int().min(0).default(0)
});

const createDispatchRequestSchema = z.object({
  orderId: z.string().min(1),
  channel: z.enum(["doordash", "ubereats", "grubhub"]),
  priority: z.enum(["normal", "high"]).default("normal"),
  correlationId: z.string().min(1).max(120).optional()
});

const createDeliveryActionRequestSchema = z.object({
  channel: z.enum(["doordash", "ubereats", "grubhub"]),
  action: z.enum(["accept", "reject", "cancel", "preparing", "ready", "out_for_delivery", "delivered"]),
  reason: z.string().max(240).optional(),
  correlationId: z.string().min(1).max(120).optional()
});

const createBookingSchema = z.object({
  customerEmail: z.string().email().optional(),
  locationId: z.string().optional(),
  eventDate: z.string(),
  partySize: z.number().int().min(1),
  eventAddress: z.string().optional(),
  packageName: z.string().optional(),
  notes: z.string().optional()
});

const orderStatusSchema = z.enum(["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]);
const bookingStatusSchema = z.enum(["draft", "pending_approval", "approved", "declined", "cancelled"]);
type AdminRole = "owner" | "admin" | "manager" | "staff" | "accounting";
const adminRoleSchema = z.enum(["owner", "admin", "manager", "staff", "accounting"]);

function parseAdminRole(request: { headers: Record<string, unknown> }) {
  const rawRole = request.headers["x-admin-role"];
  if (typeof rawRole !== "string") {
    return null;
  }

  const parsed = adminRoleSchema.safeParse(rawRole);
  return parsed.success ? parsed.data : null;
}

function requireAdminRole(
  request: { headers: Record<string, unknown> },
  reply: { status: (code: number) => { send: (payload: unknown) => unknown } },
  allowedRoles: AdminRole[]
) {
  const role = parseAdminRole(request);
  if (!role || !allowedRoles.includes(role)) {
    reply.status(403).send({
      message: "Forbidden: insufficient role permissions for this operation"
    });
    return null;
  }

  return role;
}

async function writeAdminAuditEvent(input: {
  role: AdminRole;
  action: string;
  entityId: string;
  entityType: "order" | "booking" | "payment" | "integration";
  orderId?: string;
  payload?: Record<string, unknown>;
}) {
  if (!hasDatabaseUrl) {
    return;
  }

  await prisma.integrationEvent.create({
    data: {
      orderId: input.orderId,
      channel: "admin",
      eventType: `admin.${input.action}`,
      status: "recorded",
      payload: {
        role: input.role,
        entityId: input.entityId,
        entityType: input.entityType,
        ...(input.payload ?? {})
      }
    }
  });
}

function getDayRange(dateInput?: string) {
  const base = dateInput ? new Date(dateInput) : new Date();
  base.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setDate(end.getDate() + 1);
  return { start: base, end };
}

function getRecentDateKeys(days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() - index);
    keys.push(cursor.toISOString().slice(0, 10));
  }
  return keys;
}

const integrationChannels = ["doordash", "ubereats", "grubhub"] as const;
const integrationChannelSchema = z.enum(integrationChannels);
const deliveryWebhookKinds = ["orders", "status", "settlements"] as const;
type DeliveryWebhookKind = (typeof deliveryWebhookKinds)[number];

const deliveryWebhookParamsSchema = z.object({
  channel: integrationChannelSchema
});

const deliveryWebhookBodySchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  orderExternalId: z.string().optional(),
  payload: z.record(z.unknown()).default({})
});

const inboundDeliveryItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPriceCents: z.number().int().min(0),
  notes: z.string().optional()
});

const inboundDeliveryOrderSchema = z.object({
  externalOrderId: z.string().min(1),
  customerEmail: z.string().email().optional(),
  locationId: z.string().optional(),
  subtotalCents: z.number().int().min(0),
  taxCents: z.number().int().min(0).default(0),
  tipCents: z.number().int().min(0).default(0),
  items: z.array(inboundDeliveryItemSchema).min(1)
});

const inboundDeliveryStatusUpdateSchema = z.object({
  internalOrderId: z.string().min(1).optional(),
  status: z.enum(["pending", "confirmed", "preparing", "ready", "completed", "cancelled"])
});

const inboundDeliverySettlementSchema = z.object({
  settlementId: z.string().min(1),
  payoutId: z.string().min(1).optional(),
  externalOrderId: z.string().min(1).optional(),
  grossCents: z.number().int(),
  feesCents: z.number().int().min(0).default(0),
  netCents: z.number().int(),
  currency: z.string().min(3).max(3).default("usd"),
  settledAt: z.string().datetime().optional()
});

const deliveryWebhookSecretByChannel: Record<(typeof integrationChannels)[number], string | undefined> = {
  doordash: process.env.DOORDASH_WEBHOOK_SECRET,
  ubereats: process.env.UBEREATS_WEBHOOK_SECRET,
  grubhub: process.env.GRUBHUB_WEBHOOK_SECRET
};

const uberWebhookDeveloperUuidByKind: Record<DeliveryWebhookKind, string | undefined> = {
  orders: process.env.UBEREATS_ORDERS_WEBHOOK_UUID,
  status: process.env.UBEREATS_STATUS_WEBHOOK_UUID,
  settlements: process.env.UBEREATS_SETTLEMENTS_WEBHOOK_UUID
};

function isSupportedIntegrationChannel(channel: string): channel is (typeof integrationChannels)[number] {
  return integrationChannels.includes(channel as (typeof integrationChannels)[number]);
}


function parseIncomingDeliveryOrder(
  payload: Record<string, unknown>,
  channel: (typeof integrationChannels)[number]
) {
  const parsedOrder = inboundDeliveryOrderSchema.safeParse(payload.order ?? payload);
  if (!parsedOrder.success) {
    return {
      ok: false as const,
      errors: parsedOrder.error.flatten()
    };
  }

  return {
    ok: true as const,
    value: {
      ...parsedOrder.data,
      source: channel
    }
  };
}

function parseIncomingDeliveryStatusUpdate(payload: Record<string, unknown>) {
  const parsedStatus = inboundDeliveryStatusUpdateSchema.safeParse(payload.statusUpdate ?? payload);
  if (!parsedStatus.success) {
    return {
      ok: false as const,
      errors: parsedStatus.error.flatten()
    };
  }

  return {
    ok: true as const,
    value: parsedStatus.data
  };
}

function parseIncomingDeliverySettlement(payload: Record<string, unknown>) {
  const parsedSettlement = inboundDeliverySettlementSchema.safeParse(payload.settlement ?? payload);
  if (!parsedSettlement.success) {
    return {
      ok: false as const,
      errors: parsedSettlement.error.flatten()
    };
  }

  return {
    ok: true as const,
    value: parsedSettlement.data
  };
}

function extractCorrelationId(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.correlationId === "string" && payload.correlationId.length > 0) {
    return payload.correlationId;
  }

  const meta = payload.meta;
  if (meta && typeof meta === "object") {
    const metaRecord = meta as Record<string, unknown>;
    if (typeof metaRecord.correlationId === "string" && metaRecord.correlationId.length > 0) {
      return metaRecord.correlationId;
    }
  }

  return undefined;
}

function createDeliveryCorrelationId(input: {
  channel: (typeof integrationChannels)[number];
  eventType: string;
  referenceId?: string;
}) {
  const normalizedEventType = input.eventType.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "event";
  const normalizedReference = (input.referenceId ?? randomUUID()).replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 32);
  const suffix = randomUUID().slice(0, 8);
  return `dlv-${input.channel}-${normalizedEventType}-${normalizedReference}-${suffix}`;
}

function inferWebhookKindFromEventType(eventType: string): DeliveryWebhookKind | undefined {
  const normalized = eventType.toLowerCase();

  if (normalized.includes("settlement")) {
    return "settlements";
  }

  if (normalized.includes("status")) {
    return "status";
  }

  if (normalized.includes("order")) {
    return "orders";
  }

  return undefined;
}

function hasDeliveryWebhookSignature(input: {
  channel: (typeof integrationChannels)[number];
  webhookKind?: DeliveryWebhookKind;
  headers: Record<string, unknown>;
  rawBody: string;
}) {
  const configuredSecret = deliveryWebhookSecretByChannel[input.channel];
  if (!configuredSecret) {
    return false;
  }

  const providedSignatureRaw =
    (typeof input.headers["x-delivery-signature"] === "string" ? input.headers["x-delivery-signature"] : undefined) ??
    (typeof input.headers["x-signature"] === "string" ? input.headers["x-signature"] : undefined) ??
    (typeof input.headers["x-uber-signature"] === "string" ? input.headers["x-uber-signature"] : undefined) ??
    (typeof input.headers["x-uber-signature-sha256"] === "string"
      ? input.headers["x-uber-signature-sha256"]
      : undefined);

  if (!providedSignatureRaw || input.rawBody.length === 0) {
    return false;
  }

  const isSignatureValid = verifyHmacSha256Signature({
    rawBody: input.rawBody,
    signature: providedSignatureRaw,
    secret: configuredSecret
  });

  const isAuthorizationValid = hasDeliveryWebhookAuthorization({
    channel: input.channel,
    webhookKind: input.webhookKind,
    headers: input.headers
  });

  return isSignatureValid && isAuthorizationValid;
}

function hasDeliveryWebhookAuthorization(input: {
  channel: (typeof integrationChannels)[number];
  webhookKind?: DeliveryWebhookKind;
  headers: Record<string, unknown>;
}) {
  const expectedTokens =
    input.channel === "doordash"
      ? [
          process.env.DOORDASH_ORDERS_WEBHOOK_TOKEN,
          process.env.DOORDASH_STATUS_WEBHOOK_TOKEN,
          process.env.DOORDASH_SETTLEMENTS_WEBHOOK_TOKEN
        ].filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];

  if (expectedTokens.length === 0) {
    if (input.channel !== "ubereats") {
      return true;
    }

    const expectedUberUuids = [
      input.webhookKind ? uberWebhookDeveloperUuidByKind[input.webhookKind] : undefined,
      process.env.UBEREATS_WEBHOOK_UUID
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    if (expectedUberUuids.length === 0) {
      return true;
    }

    const providedUberDeveloperUuid =
      (typeof input.headers["x-uber-developer-uuid"] === "string"
        ? input.headers["x-uber-developer-uuid"]
        : undefined) ??
      (typeof input.headers["x-developer-uuid"] === "string" ? input.headers["x-developer-uuid"] : undefined);

    return (
      typeof providedUberDeveloperUuid === "string" &&
      expectedUberUuids.includes(providedUberDeveloperUuid)
    );
  }

  const providedToken =
    typeof input.headers["authorization"] === "string"
      ? input.headers["authorization"].replace("Bearer ", "")
      : undefined;

  return typeof providedToken === "string" && expectedTokens.includes(providedToken);
}

function getWebhookRawBody(request: unknown, fallbackBody: unknown) {
  const rawBody = (request as { rawBody?: unknown }).rawBody;
  if (typeof rawBody === "string") {
    return rawBody;
  }

  return typeof fallbackBody === "string" ? fallbackBody : JSON.stringify(fallbackBody ?? {});
}

async function queueDeliveryWebhookEvent(input: {
  channel: (typeof integrationChannels)[number];
  eventType: string;
  eventId: string;
  correlationId: string;
  orderId?: string;
  payload: Record<string, unknown>;
}) {
  if (!hasDatabaseUrl) {
    return {
      duplicate: false,
      eventId: `demo-${input.channel}-${input.eventId}`,
      createdAt: new Date().toISOString()
    };
  }

  const duplicate = await prisma.integrationEvent.findFirst({
    where: {
      channel: input.channel,
      eventType: input.eventType,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      },
      payload: {
        path: ["eventId"],
        equals: input.eventId
      }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true
    }
  });

  if (duplicate) {
    return {
      duplicate: true,
      eventId: duplicate.id,
      createdAt: duplicate.createdAt.toISOString()
    };
  }

  const created = await prisma.integrationEvent.create({
    data: {
      orderId: input.orderId,
      correlationId: input.correlationId,
      channel: input.channel,
      eventType: input.eventType,
      status: "queued",
      payload: {
        ...input.payload,
        eventId: input.eventId,
        correlationId: input.correlationId,
        queuedAt: new Date().toISOString()
      } as Prisma.InputJsonValue
    },
    select: {
      id: true,
      createdAt: true
    }
  });

  return {
    duplicate: false,
    eventId: created.id,
    createdAt: created.createdAt.toISOString()
  };
}

const allowedOrderTransitions: Record<z.infer<typeof orderStatusSchema>, z.infer<typeof orderStatusSchema>[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

const allowedBookingTransitions: Record<z.infer<typeof bookingStatusSchema>, z.infer<typeof bookingStatusSchema>[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "declined", "cancelled"],
  approved: ["cancelled"],
  declined: [],
  cancelled: []
};

async function resolveLocationId(locationId?: string) {
  if (!hasDatabaseUrl) {
    return null;
  }

  if (locationId) {
    return locationId;
  }

  const activeLocation = await prisma.location.findFirst({
    where: { isActive: true },
    select: { id: true }
  });

  return activeLocation?.id ?? null;
}

app.post("/api/orders", async (request, reply) => {
  const parsed = createOrderSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid order payload",
      errors: parsed.error.flatten()
    });
  }

  const subtotalCents = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0
  );
  const totalCents = subtotalCents + parsed.data.tipCents + parsed.data.taxCents;

  if (!hasDatabaseUrl) {
    return {
      id: "demo-order",
      source: parsed.data.source,
      subtotalCents,
      taxCents: parsed.data.taxCents,
      tipCents: parsed.data.tipCents,
      totalCents,
      status: "pending"
    };
  }

  const locationId = await resolveLocationId(parsed.data.locationId);
  if (!locationId) {
    return reply.status(400).send({ message: "No active location available" });
  }

  let customerId: string | undefined;
  if (parsed.data.customerEmail) {
    const customer = await prisma.customer.upsert({
      where: { email: parsed.data.customerEmail },
      update: {},
      create: { email: parsed.data.customerEmail }
    });
    customerId = customer.id;
  }

  const order = await prisma.order.create({
    data: {
      customerId,
      locationId,
      source: parsed.data.source,
      subtotalCents,
      taxCents: parsed.data.taxCents,
      tipCents: parsed.data.tipCents,
      totalCents,
      items: {
        create: parsed.data.items
      }
    },
    include: {
      items: true
    }
  });

  return order;
});

app.post("/api/delivery/dispatch", async (request, reply) => {
  const parsed = createDispatchRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid dispatch request payload",
      errors: parsed.error.flatten()
    });
  }

  if (!hasDatabaseUrl) {
    return {
      queued: true,
      dispatchId: `demo-dispatch-${Date.now()}`,
      channel: parsed.data.channel,
      orderId: parsed.data.orderId
    };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    select: {
      id: true,
      source: true,
      status: true,
      totalCents: true
    }
  });

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (order.status === "completed" || order.status === "cancelled") {
    return reply.status(409).send({
      message: "Order is no longer dispatchable",
      status: order.status
    });
  }

  const dispatchId = `${parsed.data.channel}-${order.id}-${Date.now()}`;
  const correlationId =
    parsed.data.correlationId ??
    createDeliveryCorrelationId({
      channel: parsed.data.channel,
      eventType: "delivery.dispatch.requested",
      referenceId: dispatchId
    });

  const duplicateDispatch = await prisma.integrationEvent.findFirst({
    where: {
      orderId: order.id,
      channel: parsed.data.channel,
      eventType: "delivery.dispatch.requested",
      status: {
        in: ["queued", "pending", "processed"]
      },
      createdAt: {
        gte: new Date(Date.now() - 15 * 60 * 1000)
      }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      payload: true,
      createdAt: true,
      status: true
    }
  });

  if (duplicateDispatch) {
    const payload = duplicateDispatch.payload as Record<string, unknown>;
    return {
      queued: duplicateDispatch.status !== "processed",
      duplicate: true,
      dispatchId:
        typeof payload.dispatchId === "string"
          ? payload.dispatchId
          : `${parsed.data.channel}-${order.id}`,
      channel: parsed.data.channel,
      orderId: order.id,
      correlationId: typeof payload.correlationId === "string" ? payload.correlationId : null,
      status: duplicateDispatch.status,
      createdAt: duplicateDispatch.createdAt.toISOString()
    };
  }

  await prisma.integrationEvent.create({
    data: {
      orderId: order.id,
      correlationId,
      channel: parsed.data.channel,
      eventType: "delivery.dispatch.requested",
      status: "queued",
      payload: {
        dispatchId,
        orderId: order.id,
        priority: parsed.data.priority,
        amountCents: order.totalCents,
        correlationId,
        queuedAt: new Date().toISOString()
      } as Prisma.InputJsonValue
    }
  });

  return {
    queued: true,
    dispatchId,
    channel: parsed.data.channel,
    orderId: order.id,
    correlationId
  };
});

app.post("/api/delivery/orders/:orderId/action", async (request, reply) => {
  const paramsSchema = z.object({ orderId: z.string().min(1) });
  const parsedParams = paramsSchema.safeParse(request.params);
  if (!parsedParams.success) {
    return reply.status(400).send({
      message: "Invalid order id",
      errors: parsedParams.error.flatten()
    });
  }

  const parsed = createDeliveryActionRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid delivery action payload",
      errors: parsed.error.flatten()
    });
  }

  const mapActionToProviderStatus = {
    accept: "accepted",
    reject: "cancelled",
    cancel: "cancelled",
    preparing: "preparing",
    ready: "ready",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered"
  } as const;

  if (!hasDatabaseUrl) {
    return {
      queued: true,
      eventType: "delivery.order.action.requested",
      orderId: parsedParams.data.orderId,
      channel: parsed.data.channel,
      action: parsed.data.action
    };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsedParams.data.orderId },
    select: {
      id: true,
      status: true,
      externalOrderId: true
    }
  });

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  const duplicateEvents = await prisma.integrationEvent.findMany({
    where: {
      orderId: order.id,
      channel: parsed.data.channel,
      eventType: "delivery.order.action.requested",
      status: { in: ["queued", "pending", "processed"] },
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      createdAt: true,
      payload: true
    }
  });

  const duplicateAction = duplicateEvents.find((event) => {
    const payload = event.payload as Record<string, unknown>;
    return payload.action === parsed.data.action;
  });

  if (duplicateAction) {
    const payload = duplicateAction.payload as Record<string, unknown>;
    return {
      queued: duplicateAction.status !== "processed",
      duplicate: true,
      eventId: duplicateAction.id,
      action: parsed.data.action,
      mappedStatus: payload.mappedStatus,
      correlationId: typeof payload.correlationId === "string" ? payload.correlationId : null,
      createdAt: duplicateAction.createdAt.toISOString()
    };
  }

  const mappedStatus = mapActionToProviderStatus[parsed.data.action];
  const correlationId =
    parsed.data.correlationId ??
    createDeliveryCorrelationId({
      channel: parsed.data.channel,
      eventType: "delivery.order.action.requested",
      referenceId: `${order.id}-${parsed.data.action}`
    });
  const event = await prisma.integrationEvent.create({
    data: {
      orderId: order.id,
      correlationId,
      channel: parsed.data.channel,
      eventType: "delivery.order.action.requested",
      status: "queued",
      payload: {
        orderId: order.id,
        orderExternalId: order.externalOrderId ?? `${parsed.data.channel}:${order.id}`,
        action: parsed.data.action,
        mappedStatus,
        correlationId,
        reason: parsed.data.reason ?? null,
        attempts: 0,
        queuedAt: new Date().toISOString()
      } as Prisma.InputJsonValue
    },
    select: { id: true, createdAt: true }
  });

  return {
    queued: true,
    eventId: event.id,
    orderId: order.id,
    channel: parsed.data.channel,
    action: parsed.data.action,
    mappedStatus,
    correlationId,
    createdAt: event.createdAt.toISOString()
  };
});

app.post(
  "/api/webhooks/delivery/:channel/orders",
  { config: { rawBody: true } },
  async (request, reply) => {
    const parsedParams = deliveryWebhookParamsSchema.safeParse(request.params);
    const parsedBody = deliveryWebhookBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: "Invalid delivery order webhook payload"
      });
    }

    const channel = parsedParams.data.channel;
    const rawBody = getWebhookRawBody(request, request.body);
    const requiresSignature = Boolean(deliveryWebhookSecretByChannel[channel]);
    const signatureVerified = hasDeliveryWebhookSignature({
      channel,
      webhookKind: "orders",
      headers: request.headers,
      rawBody
    });

    if (requiresSignature && !signatureVerified) {
      return reply.status(401).send({ message: "Invalid delivery webhook signature" });
    }

    const parsedOrder = parseIncomingDeliveryOrder(parsedBody.data.payload, channel);
    if (!parsedOrder.ok) {
      return reply.status(400).send({
        message: "Invalid delivery order payload",
        errors: parsedOrder.errors
      });
    }

    const correlationId =
      extractCorrelationId(parsedBody.data.payload) ??
      createDeliveryCorrelationId({
        channel,
        eventType: parsedBody.data.eventType,
        referenceId: parsedBody.data.eventId
      });

    const queued = await queueDeliveryWebhookEvent({
      channel,
      eventType: "delivery.webhook.order.received",
      eventId: parsedBody.data.eventId,
      correlationId,
      orderId: undefined,
      payload: {
        sourceEventType: parsedBody.data.eventType,
        orderExternalId:
          parsedBody.data.orderExternalId ?? parsedOrder.value.externalOrderId,
        order: parsedOrder.value,
        receivedAt: new Date().toISOString()
      }
    });

    return {
      queued: !queued.duplicate,
      duplicate: queued.duplicate,
      eventId: queued.eventId,
      channel,
      correlationId,
      signatureVerified: requiresSignature ? signatureVerified : null,
      createdAt: queued.createdAt
    };
  }
);

app.post(
  "/api/webhooks/delivery/:channel/status",
  { config: { rawBody: true } },
  async (request, reply) => {
    const parsedParams = deliveryWebhookParamsSchema.safeParse(request.params);
    const parsedBody = deliveryWebhookBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: "Invalid delivery status webhook payload"
      });
    }

    const channel = parsedParams.data.channel;
    const rawBody = getWebhookRawBody(request, request.body);
    const requiresSignature = Boolean(deliveryWebhookSecretByChannel[channel]);
    const signatureVerified = hasDeliveryWebhookSignature({
      channel,
      webhookKind: "status",
      headers: request.headers,
      rawBody
    });

    if (requiresSignature && !signatureVerified) {
      return reply.status(401).send({ message: "Invalid delivery webhook signature" });
    }

    const parsedStatus = parseIncomingDeliveryStatusUpdate(parsedBody.data.payload);
    if (!parsedStatus.ok) {
      return reply.status(400).send({
        message: "Invalid delivery status payload",
        errors: parsedStatus.errors
      });
    }

    const correlationId =
      extractCorrelationId(parsedBody.data.payload) ??
      createDeliveryCorrelationId({
        channel,
        eventType: parsedBody.data.eventType,
        referenceId: parsedBody.data.eventId
      });

    const queued = await queueDeliveryWebhookEvent({
      channel,
      eventType: "delivery.webhook.status.received",
      eventId: parsedBody.data.eventId,
      correlationId,
      orderId:
        typeof parsedStatus.value.internalOrderId === "string"
          ? parsedStatus.value.internalOrderId
          : undefined,
      payload: {
        sourceEventType: parsedBody.data.eventType,
        orderExternalId: parsedBody.data.orderExternalId,
        statusUpdate: parsedStatus.value,
        receivedAt: new Date().toISOString()
      }
    });

    return {
      queued: !queued.duplicate,
      duplicate: queued.duplicate,
      eventId: queued.eventId,
      channel,
      correlationId,
      signatureVerified: requiresSignature ? signatureVerified : null,
      createdAt: queued.createdAt
    };
  }
);

app.post(
  "/api/webhooks/delivery/:channel/settlements",
  { config: { rawBody: true } },
  async (request, reply) => {
    const parsedParams = deliveryWebhookParamsSchema.safeParse(request.params);
    const parsedBody = deliveryWebhookBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: "Invalid delivery settlement webhook payload"
      });
    }

    const channel = parsedParams.data.channel;
    const rawBody = getWebhookRawBody(request, request.body);
    const requiresSignature = Boolean(deliveryWebhookSecretByChannel[channel]);
    const signatureVerified = hasDeliveryWebhookSignature({
      channel,
      webhookKind: "settlements",
      headers: request.headers,
      rawBody
    });

    if (requiresSignature && !signatureVerified) {
      return reply.status(401).send({ message: "Invalid delivery webhook signature" });
    }

    const parsedSettlement = parseIncomingDeliverySettlement(parsedBody.data.payload);
    if (!parsedSettlement.ok) {
      return reply.status(400).send({
        message: "Invalid delivery settlement payload",
        errors: parsedSettlement.errors
      });
    }

    const correlationId =
      extractCorrelationId(parsedBody.data.payload) ??
      createDeliveryCorrelationId({
        channel,
        eventType: parsedBody.data.eventType,
        referenceId: parsedBody.data.eventId
      });

    const queued = await queueDeliveryWebhookEvent({
      channel,
      eventType: "delivery.webhook.settlement.received",
      eventId: parsedBody.data.eventId,
      correlationId,
      orderId: undefined,
      payload: {
        sourceEventType: parsedBody.data.eventType,
        orderExternalId:
          parsedBody.data.orderExternalId ?? parsedSettlement.value.externalOrderId,
        settlement: parsedSettlement.value,
        receivedAt: new Date().toISOString()
      }
    });

    return {
      queued: !queued.duplicate,
      duplicate: queued.duplicate,
      eventId: queued.eventId,
      channel,
      correlationId,
      signatureVerified: requiresSignature ? signatureVerified : null,
      createdAt: queued.createdAt
    };
  }
);

app.post("/api/catering/bookings", async (request, reply) => {
  const parsed = createBookingSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid booking payload",
      errors: parsed.error.flatten()
    });
  }

  if (!hasDatabaseUrl) {
    return {
      id: "demo-booking",
      eventDate: parsed.data.eventDate,
      partySize: parsed.data.partySize,
      status: "pending_approval"
    };
  }

  const locationId = await resolveLocationId(parsed.data.locationId);
  if (!locationId) {
    return reply.status(400).send({ message: "No active location available" });
  }

  let customerId: string | undefined;
  if (parsed.data.customerEmail) {
    const customer = await prisma.customer.upsert({
      where: { email: parsed.data.customerEmail },
      update: {},
      create: { email: parsed.data.customerEmail }
    });
    customerId = customer.id;
  }

  const booking = await prisma.cateringBooking.create({
    data: {
      customerId,
      locationId,
      eventDate: new Date(parsed.data.eventDate),
      partySize: parsed.data.partySize,
      eventAddress: parsed.data.eventAddress,
      packageName: parsed.data.packageName,
      notes: parsed.data.notes,
      status: "pending_approval"
    }
  });

  return booking;
});

app.get("/api/admin/catering/bookings", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });

  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          id: "sample-booking-001",
          eventDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
          partySize: 75,
          status: "pending_approval",
          packageName: "Pitmaster Signature",
          location: { name: "Backyard BBQ King Smokehouse" }
        }
      ]
    };
  }

  const bookings = await prisma.cateringBooking.findMany({
    orderBy: { eventDate: "asc" },
    take: query.limit,
    select: {
      id: true,
      eventDate: true,
      partySize: true,
      status: true,
      packageName: true,
      location: { select: { name: true } }
    }
  });

  return {
    data: bookings
  };
});

app.get("/api/admin/orders", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "staff", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });

  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          id: "sample-direct-001",
          source: "direct",
          status: "pending",
          totalCents: 4200,
          createdAt: new Date().toISOString()
        },
        {
          id: "sample-dd-002",
          source: "doordash",
          status: "preparing",
          totalCents: 5800,
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      id: true,
      source: true,
      status: true,
      totalCents: true,
      createdAt: true,
      location: { select: { name: true } }
    }
  });

  return {
    data: orders
  };
});

app.patch("/api/admin/orders/:orderId/status", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "staff"]);
  if (!role) {
    return;
  }

  const paramsSchema = z.object({
    orderId: z.string()
  });
  const bodySchema = z.object({
    status: orderStatusSchema
  });

  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);

  if (!params.success || !body.success) {
    return reply.status(400).send({
      message: "Invalid status update payload"
    });
  }

  if (!hasDatabaseUrl) {
    return {
      id: params.data.orderId,
      status: body.data.status
    };
  }

  const existing = await prisma.order.findUnique({
    where: { id: params.data.orderId },
    select: { id: true, status: true }
  });

  if (!existing) {
    return reply.status(404).send({ message: "Order not found" });
  }

  const currentStatus = orderStatusSchema.parse(existing.status);

  if (!allowedOrderTransitions[currentStatus].includes(body.data.status)) {
    return reply.status(409).send({
      message: `Invalid order transition from ${currentStatus} to ${body.data.status}`
    });
  }

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: { status: body.data.status },
    select: {
      id: true,
      status: true,
      updatedAt: true
    }
  });

  await writeAdminAuditEvent({
    role,
    action: "order_status_updated",
    entityId: updated.id,
    entityType: "order",
    orderId: updated.id,
    payload: {
      status: updated.status
    }
  });

  return updated;
});

app.patch("/api/admin/catering/bookings/:bookingId/status", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  const paramsSchema = z.object({
    bookingId: z.string()
  });
  const bodySchema = z.object({
    status: bookingStatusSchema
  });

  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);

  if (!params.success || !body.success) {
    return reply.status(400).send({
      message: "Invalid booking status payload"
    });
  }

  if (!hasDatabaseUrl) {
    return {
      id: params.data.bookingId,
      status: body.data.status
    };
  }

  const existing = await prisma.cateringBooking.findUnique({
    where: { id: params.data.bookingId },
    select: { id: true, status: true }
  });

  if (!existing) {
    return reply.status(404).send({ message: "Booking not found" });
  }

  const currentStatus = bookingStatusSchema.parse(existing.status);

  if (!allowedBookingTransitions[currentStatus].includes(body.data.status)) {
    return reply.status(409).send({
      message: `Invalid booking transition from ${currentStatus} to ${body.data.status}`
    });
  }

  const updated = await prisma.cateringBooking.update({
    where: { id: existing.id },
    data: { status: body.data.status },
    select: {
      id: true,
      status: true,
      updatedAt: true
    }
  });

  await writeAdminAuditEvent({
    role,
    action: "booking_status_updated",
    entityId: updated.id,
    entityType: "booking",
    payload: {
      status: updated.status
    }
  });

  return updated;
});

app.get("/api/admin/payments", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });
  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          stripePaymentIntentId: "pi_demo_001",
          orderId: "sample-direct-001",
          amountCents: 4200,
          currency: "usd",
          status: "succeeded",
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  const payments = await prisma.paymentTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      stripePaymentIntentId: true,
      orderId: true,
      amountCents: true,
      currency: true,
      status: true,
      createdAt: true
    }
  });

  return { data: payments };
});

app.post("/api/admin/payments/refunds", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const bodySchema = z.object({
    paymentIntentId: z.string(),
    amountCents: z
      .preprocess((value) => (typeof value === "string" ? Number(value) : value), z.number().int().min(1))
      .optional()
  });

  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ message: "Invalid refund payload" });
  }

  if (paymentProvider === "epos") {
    if (!hasDatabaseUrl) {
      return reply.status(202).send({
        status: "pending_manual",
        provider: paymentProvider,
        message: "EPOS refund request captured for manual processing."
      });
    }

    const eposPaymentReferences = parsed.data.paymentIntentId.startsWith("epos_txn_")
      ? [parsed.data.paymentIntentId, parsed.data.paymentIntentId.slice("epos_txn_".length)]
      : [parsed.data.paymentIntentId, `epos_txn_${parsed.data.paymentIntentId}`];
    const eposPaymentReferenceCandidates = new Set(eposPaymentReferences.map((reference) => reference.trim()));

    const refundEventTypes = [
      "admin.refund.issued",
      "admin.refund.manual_requested",
      "admin.payment_refund_created",
      "admin.payment_refund_requested"
    ] as const;

    const payment = await prisma.paymentTransaction.findFirst({
      where: {
        stripePaymentIntentId: {
          in: eposPaymentReferences,
        },
      },
      select: {
        id: true,
        orderId: true,
        amountCents: true,
        status: true,
        stripePaymentIntentId: true
      }
    });

    if (!payment) {
      return reply.status(404).send({ message: "Payment transaction not found" });
    }

    if (![
      "succeeded",
      "partially_refunded"
    ].includes(payment.status)) {
      return reply.status(400).send({ message: "Transaction is not refundable" });
    }

    const historicalRefundEvents = await prisma.integrationEvent.findMany({
      where: {
        channel: "admin",
        eventType: { in: refundEventTypes as unknown as string[] }
      },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        eventType: true,
        payload: true
      }
    });

    const alreadyRequestedCents = historicalRefundEvents.reduce((total, event) => {
      if (!refundEventTypes.includes(event.eventType as (typeof refundEventTypes)[number])) {
        return total;
      }

      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as Record<string, unknown>)
          : {};

      const payloadPaymentReference =
        typeof payload.paymentIntentId === "string"
          ? payload.paymentIntentId
          : typeof payload.stripePaymentIntentId === "string"
            ? payload.stripePaymentIntentId
            : null;

      const matchesTransaction = payload.transactionId === payment.id;
      const matchesPaymentReference =
        typeof payloadPaymentReference === "string" &&
        eposPaymentReferenceCandidates.has(payloadPaymentReference.trim());

      if (!matchesTransaction && !matchesPaymentReference) {
        return total;
      }

      const amount =
        typeof payload.requestedAmountCents === "number"
          ? payload.requestedAmountCents
          : typeof payload.requestedAmountCents === "string"
            ? Number(payload.requestedAmountCents)
          : typeof payload.amountCents === "number"
            ? payload.amountCents
            : typeof payload.amountCents === "string"
              ? Number(payload.amountCents)
            : typeof payload.refundAmountCents === "number"
              ? payload.refundAmountCents
              : typeof payload.refundAmountCents === "string"
                ? Number(payload.refundAmountCents)
              : 0;

      return total + Math.max(0, Math.floor(amount));
    }, 0);

    const maxRefundableCents = Math.max(0, payment.amountCents - alreadyRequestedCents);
    if (maxRefundableCents <= 0) {
      return reply.status(400).send({ message: "No refundable balance remains" });
    }

    const requestedAmountCents = parsed.data.amountCents ?? maxRefundableCents;
    if (requestedAmountCents > maxRefundableCents) {
      return reply.status(400).send({ message: "Refund amount exceeds transaction amount" });
    }

    const refundRequest = await prisma.integrationEvent.create({
      data: {
        orderId: payment.orderId,
        channel: "admin",
        eventType: "admin.payment_refund_requested",
        status: "pending_manual",
        payload: {
          role,
          provider: paymentProvider,
          transactionId: payment.id,
          paymentIntentId: payment.stripePaymentIntentId,
          eposTransactionId: payment.stripePaymentIntentId.startsWith("epos_txn_")
            ? payment.stripePaymentIntentId.slice("epos_txn_".length)
            : payment.stripePaymentIntentId,
          paymentAmountCents: payment.amountCents,
          previouslyRequestedCents: alreadyRequestedCents,
          requestedAmountCents,
          requestedAt: new Date().toISOString(),
          instructions:
            "Complete refund in EPOS Back Office and reconcile this pending request."
        }
      }
    });

    await sendOperationalAlert({
      type: "epos_refund_manual_action_required",
      severity: "warning",
      message: "Manual EPOS refund requested",
      details: {
        requestId: refundRequest.id,
        paymentIntentId: parsed.data.paymentIntentId,
        requestedAmountCents,
        orderId: payment.orderId
      }
    });

    return reply.status(202).send({
      requestId: refundRequest.id,
      paymentIntentId: parsed.data.paymentIntentId,
      amountCents: requestedAmountCents,
      status: "pending_manual",
      provider: paymentProvider,
      message: "EPOS refund request queued for manual processing"
    });
  }

  return reply
    .status(501)
    .send({ message: unsupportedProviderMessage("/api/admin/payments/refunds") });
});

app.get("/api/admin/payments/disputes", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });
  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    if (paymentProvider === "epos") {
      return {
        data: [
          {
            id: "sample-epos-dispute-001",
            disputeId: "epos-case-001",
            paymentIntentId: "epos_txn_demo_001",
            amountCents: 4200,
            currency: "usd",
            reason: "manual_review_required",
            status: "pending_manual",
            createdAt: new Date().toISOString()
          }
        ],
        paymentProvider,
        message: "EPOS disputes are tracked as manual-operational events."
      };
    }

    return {
      data: [
        {
          id: "sample-dispute-001",
          disputeId: "dp_demo_001",
          paymentIntentId: "pi_demo_001",
          amountCents: 4200,
          currency: "usd",
          reason: "fraudulent",
          status: "needs_response",
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  const inferDisputeProvider = (
    channel: string,
    eventType: string,
    payload: Record<string, unknown>
  ): "stripe" | "epos" => {
    const rawProvider = payload.provider;
    if (typeof rawProvider === "string") {
      const normalized = rawProvider.trim().toLowerCase();
      if (normalized === "epos") {
        return "epos";
      }
      if (normalized === "stripe") {
        return "stripe";
      }
    }

    if (
      channel === "epos" ||
      eventType.startsWith("epos.") ||
      (typeof payload.eposTransactionId === "string" && payload.eposTransactionId.length > 0)
    ) {
      return "epos";
    }

    return "epos";
  };

  const parseAmountCents = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }

    return 0;
  };

  const normalizeEpochOrIso = (value: unknown): string | null => {
    if (typeof value === "number") {
      const ms = value > 1_000_000_000_000 ? value : value * 1000;
      return new Date(ms).toISOString();
    }

    if (typeof value === "string") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
        return new Date(ms).toISOString();
      }

      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
    }

    return null;
  };

  const disputes = await prisma.integrationEvent.findMany({
    where: {
      OR: [
        {
          channel: "stripe",
          eventType: { contains: "charge.dispute" }
        },
        {
          channel: "epos",
          eventType: { contains: "dispute" }
        },
        {
          channel: "admin",
          eventType: { contains: "dispute" }
        }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      id: true,
      channel: true,
      eventType: true,
      payload: true,
      status: true,
      createdAt: true
    }
  });

  return {
    data: disputes.map((event) => {
      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as Record<string, unknown>)
          : {};

      const disputeId =
        typeof payload.disputeId === "string"
          ? payload.disputeId
          : typeof payload.caseId === "string"
            ? payload.caseId
            : event.id;

      const paymentIntentId =
        typeof payload.paymentIntentId === "string"
          ? payload.paymentIntentId
          : typeof payload.transactionReferenceCode === "string"
            ? payload.transactionReferenceCode
            : typeof payload.stripePaymentIntentId === "string"
              ? payload.stripePaymentIntentId
              : "unknown";

      return {
        id: event.id,
        disputeId,
        paymentIntentId,
        amountCents: parseAmountCents(payload.amountCents),
        currency: typeof payload.currency === "string" ? payload.currency : "unknown",
        reason: typeof payload.reason === "string" ? payload.reason : "manual_review_required",
        provider: inferDisputeProvider(event.channel, event.eventType, payload),
        eposTransactionId:
          typeof payload.eposTransactionId === "string" ? payload.eposTransactionId : null,
        dueBy: normalizeEpochOrIso(payload.evidenceDueBy),
        status: event.status,
        createdAt: event.createdAt
      };
    }),
    paymentProvider,
    message:
      paymentProvider === "epos"
        ? "EPOS disputes are tracked as manual-operational events, with legacy Stripe disputes retained for audit visibility."
        : undefined
  };
});

app.patch("/api/admin/payments/disputes/:eventId/review", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const paramsSchema = z.object({ eventId: z.string() });
  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ message: "Invalid dispute identifier" });
  }

  if (!hasDatabaseUrl) {
    return { id: params.data.eventId, status: "reviewed" };
  }

  if (paymentProvider === "epos") {
    const existingEvent = await prisma.integrationEvent.findUnique({
      where: { id: params.data.eventId },
      select: { payload: true }
    });

    const existingPayload =
      existingEvent?.payload && typeof existingEvent.payload === "object"
        ? (existingEvent.payload as Record<string, unknown>)
        : {};

    const updated = await prisma.integrationEvent.update({
      where: { id: params.data.eventId },
      data: {
        status: "reviewed",
        payload: {
          ...existingPayload,
          reviewedAt: new Date().toISOString(),
          reviewedByRole: role,
          provider: paymentProvider
        }
      },
      select: {
        id: true,
        status: true,
        payload: true
      }
    });

    await writeAdminAuditEvent({
      role,
      action: "dispute_reviewed",
      entityId: updated.id,
      entityType: "payment",
      payload: {
        reviewStatus: updated.status,
        provider: paymentProvider
      }
    });

    return updated;
  }

  if (paymentProvider !== "stripe") {
    return reply
      .status(501)
      .send({ message: unsupportedProviderMessage("/api/admin/payments/disputes/:eventId/review") });
  }

  const updated = await prisma.integrationEvent.update({
    where: { id: params.data.eventId },
    data: { status: "reviewed" },
    select: {
      id: true,
      status: true,
      payload: true
    }
  });

  const payload = updated.payload as Record<string, unknown>;
  await writeAdminAuditEvent({
    role,
    action: "dispute_reviewed",
    entityId: updated.id,
    entityType: "payment",
    payload: {
      disputeId: payload.disputeId,
      paymentIntentId: payload.paymentIntentId,
      reviewStatus: updated.status
    }
  });

  return updated;
});

app.get("/api/admin/integrations/health", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          channel: "doordash",
          status: "healthy",
          processedCount: 19,
          failedCount: 0,
          deadLetterCount: 0,
          latencyMs: 180,
          recordedAt: new Date().toISOString()
        },
        {
          channel: "ubereats",
          status: "degraded",
          processedCount: 16,
          failedCount: 1,
          deadLetterCount: 0,
          latencyMs: 390,
          recordedAt: new Date().toISOString()
        },
        {
          channel: "grubhub",
          status: "down",
          processedCount: 8,
          failedCount: 2,
          deadLetterCount: 1,
          latencyMs: 550,
          recordedAt: new Date().toISOString()
        }
      ]
    };
  }

  const [latestEvents, deadLetterByChannel] = await Promise.all([
    prisma.integrationEvent.findMany({
      where: {
        channel: { in: [...integrationChannels] },
        eventType: "delivery.sync.health"
      },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        channel: true,
        status: true,
        payload: true,
        createdAt: true
      }
    }),
    prisma.integrationEvent.groupBy({
      by: ["channel"],
      where: {
        channel: { in: [...integrationChannels] },
        status: "dead_letter"
      },
      _count: { _all: true }
    })
  ]);

  const deadLetterMap = new Map<string, number>();
  deadLetterByChannel.forEach((row: { channel: string; _count: { _all: number } }) => {
    deadLetterMap.set(row.channel, row._count._all);
  });

  const byChannel = new Map<string, (typeof latestEvents)[number]>();
  for (const event of latestEvents) {
    if (!byChannel.has(event.channel)) {
      byChannel.set(event.channel, event);
    }
  }

  return {
    data: integrationChannels.map((channel) => {
      const event = byChannel.get(channel);
      const payload = (event?.payload ?? {}) as Record<string, unknown>;
      return {
        channel,
        status: event?.status ?? "unknown",
        processedCount: typeof payload.processedCount === "number" ? payload.processedCount : 0,
        failedCount: typeof payload.failedCount === "number" ? payload.failedCount : 0,
        deadLetterCount: deadLetterMap.get(channel) ?? 0,
        latencyMs: typeof payload.latencyMs === "number" ? payload.latencyMs : 0,
        recordedAt: event?.createdAt ?? null
      };
    })
  };
});

app.get("/api/admin/integrations/alerts", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  if (!hasDatabaseUrl) {
    return {
      summary: {
        critical: 1,
        warning: 1,
        info: 1
      },
      alerts: [
        {
          severity: "critical",
          channel: "grubhub",
          message: "Channel status is down and requires manual intervention"
        },
        {
          severity: "warning",
          channel: "ubereats",
          message: "Channel status degraded with elevated latency"
        },
        {
          severity: "info",
          channel: "doordash",
          message: "Dead-letter queue has pending retries"
        }
      ]
    };
  }

  const [latestEvents, deadLetterByChannel] = await Promise.all([
    prisma.integrationEvent.findMany({
      where: {
        channel: { in: [...integrationChannels] },
        eventType: "delivery.sync.health"
      },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        channel: true,
        status: true,
        payload: true
      }
    }),
    prisma.integrationEvent.groupBy({
      by: ["channel"],
      where: {
        channel: { in: [...integrationChannels] },
        status: "dead_letter"
      },
      _count: { _all: true }
    })
  ]);

  const channelEventMap = new Map<string, (typeof latestEvents)[number]>();
  for (const event of latestEvents) {
    if (!channelEventMap.has(event.channel)) {
      channelEventMap.set(event.channel, event);
    }
  }

  const deadLetterMap = new Map<string, number>();
  deadLetterByChannel.forEach((row: { channel: string; _count: { _all: number } }) => {
    deadLetterMap.set(row.channel, row._count._all);
  });

  const alerts: Array<{ severity: "critical" | "warning" | "info"; channel: string; message: string }> = [];

  integrationChannels.forEach((channel) => {
    const event = channelEventMap.get(channel);
    const payload = (event?.payload ?? {}) as Record<string, unknown>;
    const latencyMs = typeof payload.latencyMs === "number" ? payload.latencyMs : 0;
    const deadLetters = deadLetterMap.get(channel) ?? 0;

    if (event?.status === "down") {
      alerts.push({
        severity: "critical",
        channel,
        message: "Channel status is down and requires manual intervention"
      });
    } else if (event?.status === "degraded" || latencyMs >= 450) {
      alerts.push({
        severity: "warning",
        channel,
        message: "Channel status degraded with elevated latency"
      });
    }

    if (deadLetters >= 1) {
      alerts.push({
        severity: event?.status === "down" ? "warning" : "info",
        channel,
        message: `Dead-letter queue contains ${deadLetters} pending event(s)`
      });
    }
  });

  const summary = alerts.reduce(
    (acc, alert) => {
      acc[alert.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  return {
    summary,
    alerts
  };
});

app.get("/api/admin/integrations/dead-letter", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });
  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          id: "dead-letter-001",
          channel: "grubhub",
          eventType: "delivery.order.sync",
          status: "dead_letter",
          payload: {
            reason: "Delivery provider timeout while syncing status callback",
            orderExternalId: "grubhub-dlq-demo"
          },
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  const rows = await prisma.integrationEvent.findMany({
    where: {
      channel: { in: [...integrationChannels] },
      status: { in: ["dead_letter", "retry_failed", "retried"] }
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      id: true,
      channel: true,
      eventType: true,
      status: true,
      payload: true,
      createdAt: true
    }
  });

  return {
    data: rows
  };
});

app.patch("/api/admin/integrations/dead-letter/:eventId/retry", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  const paramsSchema = z.object({ eventId: z.string() });
  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ message: "Invalid dead-letter event id" });
  }

  if (!hasDatabaseUrl) {
    return {
      id: params.data.eventId,
      status: "queued"
    };
  }

  const existing = await prisma.integrationEvent.findUnique({
    where: { id: params.data.eventId },
    select: {
      id: true,
      status: true,
      channel: true,
      payload: true
    }
  });

  if (!existing) {
    return reply.status(404).send({ message: "Dead-letter event not found" });
  }

  if (existing.status !== "dead_letter" && existing.status !== "retry_failed") {
    return reply.status(409).send({ message: `Cannot retry event with status ${existing.status}` });
  }

  const payload = existing.payload as Record<string, unknown>;
  const previousAttempts = typeof payload.attempts === "number" ? payload.attempts : 0;

  const updated = await prisma.integrationEvent.update({
    where: { id: existing.id },
    data: {
      status: "queued",
      payload: {
        ...payload,
        attempts: previousAttempts + 1,
        retriedAt: new Date().toISOString(),
        retryRequestedByRole: role,
        lastError: null
      }
    },
    select: {
      id: true,
      status: true,
      channel: true
    }
  });

  await writeAdminAuditEvent({
    role,
    action: "integration_dead_letter_retried",
    entityId: updated.id,
    entityType: "integration",
    payload: {
      channel: updated.channel,
      status: updated.status
    }
  });

  return updated;
});

app.get("/api/admin/accounting/daily-close", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    date: z.string().optional()
  });
  const query = querySchema.parse(request.query);
  const { start, end } = getDayRange(query.date);

  if (!hasDatabaseUrl) {
    return {
      date: start.toISOString().slice(0, 10),
      summary: {
        grossSalesCents: 196500,
        refundedCents: 12000,
        settlementNetCents: 109200,
        netSalesCents: 184500,
        netAfterSettlementCents: 97200,
        outstandingDisputes: 1
      },
      bySource: [
        { source: "direct", orders: 22, totalCents: 102000 },
        { source: "doordash", orders: 10, totalCents: 60500 },
        { source: "ubereats", orders: 7, totalCents: 24000 },
        { source: "grubhub", orders: 4, totalCents: 10000 }
      ],
      settlementByChannel: [
        { channel: "doordash", grossCents: 60500, feesCents: 9075, netCents: 51425 },
        { channel: "ubereats", grossCents: 24000, feesCents: 3600, netCents: 20400 },
        { channel: "grubhub", grossCents: 10000, feesCents: 2225, netCents: 7775 }
      ]
    };
  }

  const [grossSales, sourceGroup, refundEvents, outstandingDisputes, settlementEvents] = await Promise.all([
    prisma.order.aggregate({
      where: {
        createdAt: { gte: start, lt: end },
        status: { not: "cancelled" }
      },
      _sum: { totalCents: true }
    }),
    prisma.order.groupBy({
      by: ["source"],
      where: {
        createdAt: { gte: start, lt: end },
        status: { not: "cancelled" }
      },
      _count: { _all: true },
      _sum: { totalCents: true }
    }),
    prisma.integrationEvent.findMany({
      where: buildRefundEventFilter(start, end),
      select: { payload: true }
    }),
    prisma.integrationEvent.count({
      where: {
        channel: "stripe",
        eventType: { contains: "charge.dispute" },
        status: "needs_response"
      }
    }),
    prisma.integrationEvent.findMany({
      where: {
        channel: { in: [...integrationChannels] },
        eventType: { contains: "settlement" },
        status: "processed",
        createdAt: { gte: start, lt: end }
      },
      select: {
        channel: true,
        payload: true
      }
    })
  ]);

  const refundedCents = refundEvents.reduce((sum: number, item: { payload: unknown }) => {
    const payload = item.payload as Record<string, unknown>;
    return sum + parseRefundAmountCents(payload);
  }, 0);

  const grossSalesCents = grossSales._sum.totalCents ?? 0;

  const settlementByChannelMap = new Map<string, { grossCents: number; feesCents: number; netCents: number }>();
  let settlementNetCents = 0;

  for (const settlementEvent of settlementEvents) {
    const payload = settlementEvent.payload as Record<string, unknown>;
    const settlementPayload =
      payload.settlement && typeof payload.settlement === "object"
        ? (payload.settlement as Record<string, unknown>)
        : payload;

    const grossCents =
      typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    const feesCents = typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;
    const netCents = typeof settlementPayload.netCents === "number" ? settlementPayload.netCents : 0;

    settlementNetCents += netCents;

    const existing = settlementByChannelMap.get(settlementEvent.channel) ?? {
      grossCents: 0,
      feesCents: 0,
      netCents: 0
    };
    existing.grossCents += grossCents;
    existing.feesCents += feesCents;
    existing.netCents += netCents;
    settlementByChannelMap.set(settlementEvent.channel, existing);
  }

  return {
    date: start.toISOString().slice(0, 10),
    summary: {
      grossSalesCents,
      refundedCents,
      netSalesCents: Math.max(0, grossSalesCents - refundedCents),
      settlementNetCents,
      netAfterSettlementCents: Math.max(0, grossSalesCents - refundedCents - settlementNetCents),
      outstandingDisputes
    },
    bySource: sourceGroup.map((row: { source: string; _count: { _all: number }; _sum: { totalCents: number | null } }) => ({
      source: row.source,
      orders: row._count._all,
      totalCents: row._sum.totalCents ?? 0
    })),
    settlementByChannel: Array.from(settlementByChannelMap.entries()).map(([channel, totals]) => ({
      channel,
      grossCents: totals.grossCents,
      feesCents: totals.feesCents,
      netCents: totals.netCents
    }))
  };
});

app.post("/api/admin/accounting/daily-close/finalize", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const bodySchema = z.object({
    date: z.string().optional()
  });
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ message: "Invalid daily close payload" });
  }

  const { start } = getDayRange(parsed.data.date);

  await writeAdminAuditEvent({
    role,
    action: "daily_close_finalized",
    entityId: start.toISOString().slice(0, 10),
    entityType: "payment",
    payload: {
      date: start.toISOString().slice(0, 10)
    }
  });

  return {
    date: start.toISOString().slice(0, 10),
    status: "finalized"
  };
});

app.get("/api/admin/accounting/daily-close/export", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    date: z.string().optional()
  });
  const query = querySchema.parse(request.query);
  const { start, end } = getDayRange(query.date);
  const reportDate = start.toISOString().slice(0, 10);

  let grossSalesCents = 196500;
  let refundedCents = 12000;
  let netSalesCents = 184500;
  let settlementNetCents = 109200;
  let netAfterSettlementCents = 97200;
  let outstandingDisputes = 1;
  let bySource: Array<{ source: string; orders: number; totalCents: number }> = [
    { source: "direct", orders: 22, totalCents: 102000 },
    { source: "doordash", orders: 10, totalCents: 60500 }
  ];

  if (hasDatabaseUrl) {
    const [grossSales, sourceGroup, refundEvents, disputes, settlementEvents] = await Promise.all([
      prisma.order.aggregate({
        where: {
          createdAt: { gte: start, lt: end },
          status: { not: "cancelled" }
        },
        _sum: { totalCents: true }
      }),
      prisma.order.groupBy({
        by: ["source"],
        where: {
          createdAt: { gte: start, lt: end },
          status: { not: "cancelled" }
        },
        _count: { _all: true },
        _sum: { totalCents: true }
      }),
      prisma.integrationEvent.findMany({
        where: buildRefundEventFilter(start, end),
        select: { payload: true }
      }),
      prisma.integrationEvent.count({
        where: {
          channel: "stripe",
          eventType: { contains: "charge.dispute" },
          status: "needs_response"
        }
      }),
      prisma.integrationEvent.findMany({
        where: {
          channel: { in: [...integrationChannels] },
          eventType: { contains: "settlement" },
          status: "processed",
          createdAt: { gte: start, lt: end }
        },
        select: { payload: true }
      })
    ]);

    refundedCents = refundEvents.reduce((sum: number, item: { payload: unknown }) => {
      const payload = item.payload as Record<string, unknown>;
      return sum + parseRefundAmountCents(payload);
    }, 0);
    grossSalesCents = grossSales._sum.totalCents ?? 0;
    netSalesCents = Math.max(0, grossSalesCents - refundedCents);
    outstandingDisputes = disputes;

    settlementNetCents = settlementEvents.reduce((sum: number, item: { payload: unknown }) => {
      const payload = item.payload as Record<string, unknown>;
      const settlementPayload =
        payload.settlement && typeof payload.settlement === "object"
          ? (payload.settlement as Record<string, unknown>)
          : payload;
      const net = typeof settlementPayload.netCents === "number" ? settlementPayload.netCents : 0;
      return sum + net;
    }, 0);
    netAfterSettlementCents = Math.max(0, netSalesCents - settlementNetCents);

    bySource = sourceGroup.map((row: { source: string; _count: { _all: number }; _sum: { totalCents: number | null } }) => ({
      source: row.source,
      orders: row._count._all,
      totalCents: row._sum.totalCents ?? 0
    }));
  }

  const header = "date,source,orders,total_cents,gross_sales_cents,refunded_cents,net_sales_cents,settlement_net_cents,net_after_settlement_cents,outstanding_disputes";
  const rows = bySource.map(
    (row) =>
      `${reportDate},${row.source},${row.orders},${row.totalCents},${grossSalesCents},${refundedCents},${netSalesCents},${settlementNetCents},${netAfterSettlementCents},${outstandingDisputes}`
  );
  const csv = [header, ...rows].join("\n");

  reply.header("Content-Type", "text/csv; charset=utf-8");
  reply.header("Content-Disposition", `attachment; filename=bbq-daily-close-${reportDate}.csv`);
  return reply.send(csv);
});

async function buildSalesAnalytics(days: number) {
  if (!hasDatabaseUrl) {
    return {
      windowDays: days,
      totals: {
        orders: 118,
        grossSalesCents: 468200,
        averageOrderValueCents: 3968
      },
      daily: [
        { date: "2026-05-12", orders: 37, grossSalesCents: 143000 },
        { date: "2026-05-13", orders: 39, grossSalesCents: 155400 },
        { date: "2026-05-14", orders: 42, grossSalesCents: 169800 }
      ],
      bySource: [
        { source: "direct", orders: 56, grossSalesCents: 241500 },
        { source: "doordash", orders: 29, grossSalesCents: 122200 },
        { source: "ubereats", orders: 21, grossSalesCents: 70200 },
        { source: "grubhub", orders: 12, grossSalesCents: 34300 }
      ],
      topItems: [
        { name: "Brisket Plate", quantity: 74, revenueCents: 118400 },
        { name: "Pulled Pork Sandwich", quantity: 63, revenueCents: 81900 },
        { name: "Smoked Wings", quantity: 48, revenueCents: 62400 }
      ]
    };
  }

  const recentDateKeys = getRecentDateKeys(days);
  const oldestDate = recentDateKeys[0];
  const start = new Date(`${oldestDate}T00:00:00.000Z`);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start },
      status: { not: "cancelled" }
    },
    select: {
      source: true,
      totalCents: true,
      createdAt: true,
      items: {
        select: {
          menuItemName: true,
          quantity: true,
          unitPriceCents: true
        }
      }
    }
  });

  const dailyMap = new Map<string, { orders: number; grossSalesCents: number }>();
  const sourceMap = new Map<string, { orders: number; grossSalesCents: number }>();
  const itemMap = new Map<string, { quantity: number; revenueCents: number }>();

  recentDateKeys.forEach((key) => {
    dailyMap.set(key, { orders: 0, grossSalesCents: 0 });
  });

  let grossSalesCents = 0;
  for (const order of orders) {
    const dateKey = order.createdAt.toISOString().slice(0, 10);
    const day = dailyMap.get(dateKey);
    if (day) {
      day.orders += 1;
      day.grossSalesCents += order.totalCents;
    }

    const source = sourceMap.get(order.source) ?? { orders: 0, grossSalesCents: 0 };
    source.orders += 1;
    source.grossSalesCents += order.totalCents;
    sourceMap.set(order.source, source);

    grossSalesCents += order.totalCents;

    for (const item of order.items) {
      const row = itemMap.get(item.menuItemName) ?? { quantity: 0, revenueCents: 0 };
      row.quantity += item.quantity;
      row.revenueCents += item.quantity * item.unitPriceCents;
      itemMap.set(item.menuItemName, row);
    }
  }

  const topItems = Array.from(itemMap.entries())
    .map(([name, value]) => ({ name, quantity: value.quantity, revenueCents: value.revenueCents }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 8);

  return {
    windowDays: days,
    totals: {
      orders: orders.length,
      grossSalesCents,
      averageOrderValueCents: orders.length > 0 ? Math.round(grossSalesCents / orders.length) : 0
    },
    daily: recentDateKeys.map((key) => ({
      date: key,
      orders: dailyMap.get(key)?.orders ?? 0,
      grossSalesCents: dailyMap.get(key)?.grossSalesCents ?? 0
    })),
    bySource: Array.from(sourceMap.entries())
      .map(([source, value]) => ({
        source,
        orders: value.orders,
        grossSalesCents: value.grossSalesCents
      }))
      .sort((a, b) => b.grossSalesCents - a.grossSalesCents),
    topItems
  };
}

async function buildForecastAnalytics(days: number) {
  if (!hasDatabaseUrl) {
    return {
      horizonDays: days,
      baseline: {
        trailingAverageOrders: 41,
        trailingAverageSalesCents: 168300
      },
      forecast: Array.from({ length: days }).map((_, index) => ({
        date: new Date(Date.now() + (index + 1) * 86400000).toISOString().slice(0, 10),
        predictedOrders: 40 + (index % 3),
        predictedSalesCents: 166000 + index * 4200,
        confidence: Number(Math.max(0.62, 0.9 - index * 0.03).toFixed(2))
      }))
    };
  }

  const historyDays = 21;
  const recentDateKeys = getRecentDateKeys(historyDays);
  const oldestDate = recentDateKeys[0];
  const historyStart = new Date(`${oldestDate}T00:00:00.000Z`);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: historyStart },
      status: { not: "cancelled" }
    },
    select: {
      createdAt: true,
      totalCents: true
    }
  });

  const dailyMap = new Map<string, { orders: number; salesCents: number; weekday: number }>();
  const weekdayMap = new Map<number, { orders: number; salesCents: number; days: number }>();

  recentDateKeys.forEach((key) => {
    const stamp = new Date(`${key}T00:00:00.000Z`);
    dailyMap.set(key, { orders: 0, salesCents: 0, weekday: stamp.getUTCDay() });
  });

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const row = dailyMap.get(key);
    if (row) {
      row.orders += 1;
      row.salesCents += order.totalCents;
    }
  }

  const historyRows = recentDateKeys.map((key) => dailyMap.get(key)).filter(Boolean) as Array<{
    orders: number;
    salesCents: number;
    weekday: number;
  }>;

  for (const row of historyRows) {
    const weekday = weekdayMap.get(row.weekday) ?? { orders: 0, salesCents: 0, days: 0 };
    weekday.orders += row.orders;
    weekday.salesCents += row.salesCents;
    weekday.days += 1;
    weekdayMap.set(row.weekday, weekday);
  }

  const trailingWindow = historyRows.slice(-14);
  const previousWindow = historyRows.slice(-21, -14);

  const trailingOrdersAvg =
    trailingWindow.length > 0
      ? trailingWindow.reduce((sum, row) => sum + row.orders, 0) / trailingWindow.length
      : 0;
  const trailingSalesAvg =
    trailingWindow.length > 0
      ? trailingWindow.reduce((sum, row) => sum + row.salesCents, 0) / trailingWindow.length
      : 0;

  const previousOrdersAvg =
    previousWindow.length > 0
      ? previousWindow.reduce((sum, row) => sum + row.orders, 0) / previousWindow.length
      : trailingOrdersAvg;
  const previousSalesAvg =
    previousWindow.length > 0
      ? previousWindow.reduce((sum, row) => sum + row.salesCents, 0) / previousWindow.length
      : trailingSalesAvg;

  const ordersTrendPerWeek = trailingOrdersAvg - previousOrdersAvg;
  const salesTrendPerWeek = trailingSalesAvg - previousSalesAvg;

  const orderVariance =
    trailingWindow.length > 0
      ? trailingWindow.reduce((sum, row) => sum + Math.pow(row.orders - trailingOrdersAvg, 2), 0) /
        trailingWindow.length
      : 0;
  const orderStdDev = Math.sqrt(orderVariance);
  const volatilityPenalty = Math.min(0.25, orderStdDev / 20);

  const forecast = Array.from({ length: days }).map((_, index) => {
    const dayOffset = index + 1;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + dayOffset);
    const weekday = date.getUTCDay();

    const weekdayStats = weekdayMap.get(weekday);
    const weekdayOrderFactor =
      weekdayStats && trailingOrdersAvg > 0
        ? Math.max(0.7, Math.min(1.35, weekdayStats.orders / Math.max(weekdayStats.days, 1) / trailingOrdersAvg))
        : 1;
    const weekdaySalesFactor =
      weekdayStats && trailingSalesAvg > 0
        ? Math.max(0.7, Math.min(1.35, weekdayStats.salesCents / Math.max(weekdayStats.days, 1) / trailingSalesAvg))
        : 1;

    const trendWeight = dayOffset / 7;
    const predictedOrders = Math.max(
      0,
      Math.round((trailingOrdersAvg + ordersTrendPerWeek * trendWeight) * weekdayOrderFactor)
    );
    const predictedSalesCents = Math.max(
      0,
      Math.round((trailingSalesAvg + salesTrendPerWeek * trendWeight) * weekdaySalesFactor)
    );
    const confidence = Number(
      Math.max(0.52, Math.min(0.94, 0.9 - dayOffset * 0.035 - volatilityPenalty)).toFixed(2)
    );

    return {
      date: date.toISOString().slice(0, 10),
      predictedOrders,
      predictedSalesCents,
      confidence
    };
  });

  return {
    horizonDays: days,
    baseline: {
      trailingAverageOrders: Number(trailingOrdersAvg.toFixed(2)),
      trailingAverageSalesCents: Math.round(trailingSalesAvg)
    },
    forecast
  };
}

app.get("/api/admin/analytics/sales", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(3).max(90).default(14)
  });
  const query = querySchema.parse(request.query);

  return buildSalesAnalytics(query.days);
});

app.get("/api/admin/analytics/sales/export", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(3).max(90).default(14)
  });
  const query = querySchema.parse(request.query);
  const analytics = await buildSalesAnalytics(query.days);

  const header = "section,key,orders,amount_cents,quantity";
  const rows: string[] = [];
  analytics.daily.forEach((row) => {
    rows.push(`daily,${row.date},${row.orders},${row.grossSalesCents},`);
  });
  analytics.bySource.forEach((row) => {
    rows.push(`source,${row.source},${row.orders},${row.grossSalesCents},`);
  });
  analytics.topItems.forEach((row) => {
    rows.push(`item,${row.name},,${row.revenueCents},${row.quantity}`);
  });

  const csv = [header, ...rows].join("\n");
  reply.header("Content-Type", "text/csv; charset=utf-8");
  reply.header("Content-Disposition", `attachment; filename=bbq-analytics-sales-${query.days}d.csv`);
  return reply.send(csv);
});

app.get("/api/admin/analytics/forecast", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(3).max(30).default(7)
  });
  const query = querySchema.parse(request.query);

  return buildForecastAnalytics(query.days);
});

app.get("/api/admin/analytics/forecast/export", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(3).max(30).default(7)
  });
  const query = querySchema.parse(request.query);
  const forecast = await buildForecastAnalytics(query.days);

  const header = "date,predicted_orders,predicted_sales_cents,confidence";
  const rows = forecast.forecast.map(
    (row) => `${row.date},${row.predictedOrders},${row.predictedSalesCents},${row.confidence}`
  );
  const csv = [header, ...rows].join("\n");

  reply.header("Content-Type", "text/csv; charset=utf-8");
  reply.header("Content-Disposition", `attachment; filename=bbq-analytics-forecast-${query.days}d.csv`);
  return reply.send(csv);
});

app.get("/api/admin/analytics/anomalies", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(7).max(60).default(21)
  });
  const query = querySchema.parse(request.query);

  const sales = await buildSalesAnalytics(query.days);
  const forecast = await buildForecastAnalytics(7);

  const anomalies: Array<{ severity: "critical" | "warning" | "info"; title: string; detail: string }> = [];
  const totalDays = Math.max(1, sales.daily.length);
  const trailingAverageSales = Math.round(
    sales.daily.reduce((sum, row) => sum + row.grossSalesCents, 0) / totalDays
  );
  const trailingAverageOrders = Math.round(
    sales.daily.reduce((sum, row) => sum + row.orders, 0) / totalDays
  );
  const latest = sales.daily[sales.daily.length - 1] ?? { grossSalesCents: 0, orders: 0, date: "n/a" };

  if (trailingAverageSales > 0 && latest.grossSalesCents < trailingAverageSales * 0.68) {
    anomalies.push({
      severity: "warning",
      title: "Sales dip detected",
      detail: `${latest.date} sales are ${(latest.grossSalesCents / trailingAverageSales * 100).toFixed(0)}% of trailing average`
    });
  }

  if (trailingAverageOrders > 0 && latest.orders > trailingAverageOrders * 1.45) {
    anomalies.push({
      severity: "info",
      title: "Order spike detected",
      detail: `${latest.date} order count is above 145% of trailing average`
    });
  }

  const highestSource = sales.bySource[0];
  if (highestSource && sales.totals.grossSalesCents > 0) {
    const concentration = highestSource.grossSalesCents / sales.totals.grossSalesCents;
    if (concentration >= 0.62) {
      anomalies.push({
        severity: "warning",
        title: "Channel concentration risk",
        detail: `${highestSource.source} represents ${(concentration * 100).toFixed(0)}% of gross sales`
      });
    }
  }

  const lowConfidenceCount = forecast.forecast.filter((row) => row.confidence < 0.65).length;
  if (lowConfidenceCount >= 2) {
    anomalies.push({
      severity: "info",
      title: "Forecast confidence softening",
      detail: `${lowConfidenceCount} forecast day(s) are below 65% confidence`
    });
  }

  const summary = anomalies.reduce(
    (acc, anomaly) => {
      acc[anomaly.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  return {
    windowDays: query.days,
    summary,
    anomalies
  };
});

app.get("/api/admin/overview", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  if (!hasDatabaseUrl) {
    return {
      totals: {
        pendingOrders: 8,
        activeBookings: 3,
        grossSalesCentsToday: 196500
      }
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pendingOrders, activeBookings, grossSales] = await Promise.all([
    prisma.order.count({ where: { status: { in: ["pending", "confirmed", "preparing", "ready"] } } }),
    prisma.cateringBooking.count({ where: { status: { in: ["pending_approval", "approved"] } } }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: todayStart },
        status: { not: "cancelled" }
      },
      _sum: {
        totalCents: true
      }
    })
  ]);

  return {
    totals: {
      pendingOrders,
      activeBookings,
      grossSalesCentsToday: grossSales._sum.totalCents ?? 0
    }
  };
});

app.post("/api/catering/availability", async (request, reply) => {
  const payloadSchema = z.object({
    date: z.string(),
    partySize: z.number().int().min(1),
    locationId: z.string().optional()
  });

  const parsed = payloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid request payload",
      errors: parsed.error.flatten()
    });
  }

  let capacity = 200;
  let bookedPartySize = 0;

  if (hasDatabaseUrl) {
    try {
      const start = new Date(parsed.data.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const targetLocationId = parsed.data.locationId
        ? parsed.data.locationId
        : (
            await prisma.location.findFirst({
              where: { isActive: true },
              select: { id: true, maxCateringCap: true }
            })
          )?.id;

      if (targetLocationId) {
        const location = await prisma.location.findUnique({
          where: { id: targetLocationId },
          select: { maxCateringCap: true }
        });
        capacity = location?.maxCateringCap ?? capacity;

        const aggregate = await prisma.cateringBooking.aggregate({
          where: {
            locationId: targetLocationId,
            eventDate: { gte: start, lt: end },
            status: { in: ["pending_approval", "approved"] }
          },
          _sum: {
            partySize: true
          }
        });
        bookedPartySize = aggregate._sum.partySize ?? 0;
      }
    } catch (error) {
      request.log.warn({ error }, "Falling back to static capacity heuristic");
    }
  }

  const remainingCapacity = Math.max(0, capacity - bookedPartySize);
  const available = parsed.data.partySize <= remainingCapacity;

  return {
    date: parsed.data.date,
    partySize: parsed.data.partySize,
    available,
    remainingCapacity,
    nextSteps: available
      ? "Proceed to package builder and deposit checkout"
      : "Select a different date or reduce event size"
  };
});

app.post(
  "/api/webhooks/:channel",
  {
    config: {
      rawBody: true
    }
  },
  async (request, reply) => {
    const parsedParams = deliveryWebhookParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        message: "Invalid delivery webhook channel",
        errors: parsedParams.error.flatten()
      });
    }

    const channel = parsedParams.data.channel;
    if (!isSupportedIntegrationChannel(channel)) {
      return reply.status(400).send({ message: "Unsupported delivery webhook channel" });
    }

    if (await isWebhookRateLimited(request.ip)) {
      return reply.status(429).send({ message: "Too many webhook requests" });
    }

    const raw = (request as typeof request & { rawBody?: string }).rawBody;
    if (!raw) {
      return reply.status(400).send({ message: "Missing webhook payload" });
    }

    const parsedBody = deliveryWebhookBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "Invalid delivery webhook payload",
        errors: parsedBody.error.flatten()
      });
    }

    const webhookKind = inferWebhookKindFromEventType(parsedBody.data.eventType);

    if (!hasDeliveryWebhookSignature({ channel, webhookKind, headers: request.headers, rawBody: raw })) {
      await sendOperationalAlert({
        type: "delivery_webhook_signature_invalid",
        severity: "critical",
        message: "Delivery webhook signature verification failed",
        details: {
          channel,
          requestIp: request.ip
        }
      });
      return reply.status(401).send({ message: "Invalid signature" });
    }

    const payloadCorrelationId = extractCorrelationId(parsedBody.data.payload);
    const correlationId =
      payloadCorrelationId ??
      createDeliveryCorrelationId({
        channel,
        eventType: parsedBody.data.eventType,
        referenceId: parsedBody.data.eventId
      });

    const dedupeKey = `${channel}:${parsedBody.data.eventId}`;
    if (await isDuplicateWebhookEvent(dedupeKey)) {
      return { received: true, duplicate: true, correlationId };
    }

    const parsedDeliveryOrder = parseIncomingDeliveryOrder(parsedBody.data.payload, channel);
    const parsedStatusUpdate = parseIncomingDeliveryStatusUpdate(parsedBody.data.payload);
    const parsedSettlement = parseIncomingDeliverySettlement(parsedBody.data.payload);

    if (!hasDatabaseUrl) {
      return {
        received: true,
        channel,
        eventId: parsedBody.data.eventId,
        correlationId,
        ingestedOrder: parsedDeliveryOrder.ok ? parsedDeliveryOrder.value.externalOrderId : null,
        ingestedSettlement: parsedSettlement.ok ? parsedSettlement.value.settlementId : null
      };
    }

    {
      const duplicateEvent = await prisma.integrationEvent.findFirst({
        where: {
          channel,
          eventType: parsedBody.data.eventType,
          createdAt: {
            gte: new Date(Date.now() - webhookEventTtlMs)
          },
          payload: {
            path: ["eventId"],
            equals: parsedBody.data.eventId
          }
        },
        select: { id: true }
      });

      if (duplicateEvent) {
        return { received: true, duplicate: true, correlationId };
      }

      let orderId: string | undefined;
      let ingestStatus: "processed" | "ignored" | "failed" = "ignored";
      let ingestReason: string | undefined;

      if (parsedBody.data.eventType.includes("settlement")) {
        if (!parsedSettlement.ok) {
          ingestStatus = "failed";
          ingestReason = "invalid_settlement_payload";
        } else {
          const duplicateSettlement = await prisma.integrationEvent.findFirst({
            where: {
              channel,
              eventType: { contains: "settlement" },
              createdAt: {
                gte: new Date(Date.now() - settlementIdempotencyWindowMs)
              },
              OR: [
                {
                  payload: {
                    path: ["settlement", "settlementId"],
                    equals: parsedSettlement.value.settlementId
                  }
                },
                {
                  payload: {
                    path: ["settlementId"],
                    equals: parsedSettlement.value.settlementId
                  }
                }
              ]
            },
            select: { id: true }
          });

          if (duplicateSettlement) {
            return {
              received: true,
              duplicate: true,
              duplicateType: "settlement",
              settlementId: parsedSettlement.value.settlementId,
              correlationId
            };
          }

          const settlementOrderExternalId =
            parsedSettlement.value.externalOrderId ?? parsedBody.data.orderExternalId;

          if (settlementOrderExternalId) {
            const matchedOrder = await prisma.order.findFirst({
              where: {
                externalChannel: channel,
                externalOrderId: settlementOrderExternalId
              },
              select: { id: true }
            });
            orderId = matchedOrder?.id;
          }

          ingestStatus = "processed";
        }
      } else if (parsedBody.data.eventType.includes("order") && !parsedBody.data.eventType.includes("status")) {
        if (!parsedDeliveryOrder.ok) {
          ingestStatus = "failed";
          ingestReason = "invalid_order_payload";
        } else {
          const externalOrderId =
            parsedBody.data.orderExternalId ?? parsedDeliveryOrder.value.externalOrderId;

          const existingOrder = await prisma.order.findFirst({
            where: {
              externalChannel: channel,
              externalOrderId
            },
            select: { id: true }
          });

          if (existingOrder) {
            orderId = existingOrder.id;
            ingestStatus = "processed";
            ingestReason = "duplicate_external_order_ignored";
          } else {
          const locationId = await resolveLocationId(parsedDeliveryOrder.value.locationId);
          if (!locationId) {
            ingestStatus = "failed";
            ingestReason = "location_not_found";
          } else {
            let customerId: string | undefined;
            if (parsedDeliveryOrder.value.customerEmail) {
              const customer = await prisma.customer.upsert({
                where: { email: parsedDeliveryOrder.value.customerEmail },
                update: {},
                create: { email: parsedDeliveryOrder.value.customerEmail }
              });
              customerId = customer.id;
            }

            const totalCents =
              parsedDeliveryOrder.value.subtotalCents +
              parsedDeliveryOrder.value.taxCents +
              parsedDeliveryOrder.value.tipCents;

            const createdOrder = await prisma.order.create({
              data: {
                customerId,
                locationId,
                correlationId,
                source: parsedDeliveryOrder.value.source,
                externalChannel: channel,
                externalOrderId,
                subtotalCents: parsedDeliveryOrder.value.subtotalCents,
                taxCents: parsedDeliveryOrder.value.taxCents,
                tipCents: parsedDeliveryOrder.value.tipCents,
                totalCents,
                items: {
                  create: parsedDeliveryOrder.value.items.map((item) => ({
                    menuItemName: item.name,
                    quantity: item.quantity,
                    unitPriceCents: item.unitPriceCents,
                    notes: item.notes
                  }))
                }
              },
              select: { id: true }
            });

            orderId = createdOrder.id;
            ingestStatus = "processed";
          }
          }
        }
      } else if (parsedBody.data.eventType.includes("status")) {
        const externalOrderId = parsedBody.data.orderExternalId;
        const internalOrderId = parsedStatusUpdate.ok ? parsedStatusUpdate.value.internalOrderId : undefined;

        if (!parsedStatusUpdate.ok || (!internalOrderId && !externalOrderId)) {
          ingestStatus = "failed";
          ingestReason = "invalid_status_payload";
        } else {
          const updated = await prisma.order.updateMany({
            where: {
              ...(internalOrderId
                ? { id: internalOrderId }
                : {
                    externalChannel: channel,
                    externalOrderId
                  })
            },
            data: {
              status: parsedStatusUpdate.value.status,
              correlationId
            }
          });

          if (updated.count > 0) {
            ingestStatus = "processed";
            if (internalOrderId) {
              orderId = internalOrderId;
            } else if (externalOrderId) {
              const matchedOrder = await prisma.order.findFirst({
                where: {
                  externalChannel: channel,
                  externalOrderId
                },
                select: { id: true }
              });
              orderId = matchedOrder?.id;
            }
          } else {
            ingestStatus = "failed";
            ingestReason = "order_not_found_for_status_update";
          }
        }
      }

      await prisma.integrationEvent.create({
        data: {
          orderId,
          correlationId,
          channel,
          eventType: parsedBody.data.eventType,
          status: ingestStatus,
          payload: {
            eventId: parsedBody.data.eventId,
            correlationId,
            orderExternalId: parsedBody.data.orderExternalId ?? null,
            requestIp: request.ip,
            receivedAt: new Date().toISOString(),
            ingestReason: ingestReason ?? null,
            orderParseErrors: parsedDeliveryOrder.ok ? null : parsedDeliveryOrder.errors,
            statusParseErrors: parsedStatusUpdate.ok ? null : parsedStatusUpdate.errors,
            settlementParseErrors: parsedSettlement.ok ? null : parsedSettlement.errors,
            settlement: parsedSettlement.ok
              ? {
                  settlementId: parsedSettlement.value.settlementId,
                  payoutId: parsedSettlement.value.payoutId ?? null,
                  grossCents: parsedSettlement.value.grossCents,
                  feesCents: parsedSettlement.value.feesCents,
                  netCents: parsedSettlement.value.netCents,
                  currency: typeof (parsedBody.data.payload?.currency) === "string" ? parsedBody.data.payload.currency : "unknown",
                  settledAt: parsedSettlement.value.settledAt ?? null,
                  externalOrderId:
                    parsedSettlement.value.externalOrderId ?? parsedBody.data.orderExternalId ?? null
                }
              : null,
            payload: parsedBody.data.payload
          } as Prisma.InputJsonValue
        }
      });
    }

    return { received: true, correlationId };
  }
);

app.post(
  "/api/payments/webhook",
  {
    config: {
      rawBody: true
    }
  },
  async (request, reply) => {
    const correlationId = request.correlationId;

    if (paymentProvider === "epos") {
      const eposResult = await handleEposWebhook({
        request: {
          ip: request.ip,
          headers: request.headers,
          rawBody: (request as typeof request & { rawBody?: string }).rawBody,
          correlationId,
        },
        logger: {
          warn: (payload, message) => request.log.warn(payload, message),
          info: (payload, message) => request.log.info(payload, message),
        },
        allowedIps: eposWebhookAllowedIps,
        signatureHeader: eposWebhookSignatureHeader,
        webhookSecret: eposWebhookSecret,
        requireSignature: eposWebhookRequireSignature,
        hasDatabaseUrl,
        prisma: {
          order: {
            updateMany: (args) => prisma.order.updateMany(args as never),
          },
          paymentTransaction: {
            upsert: (args) => prisma.paymentTransaction.upsert(args as never),
          },
          integrationEvent: {
            create: (args) => prisma.integrationEvent.create(args as never),
          },
        },
        isWebhookRateLimited,
        isWebhookIpAllowed,
        getRequestIps,
        verifyHmacSha256Signature,
        isDuplicateWebhookEvent,
        isPersistedDuplicateWebhookEvent: isDuplicateEposWebhookEventInDatabase,
        sendOperationalAlert,
      });

      if (eposResult.statusCode !== 200) {
        return reply.status(eposResult.statusCode).send(eposResult.body);
      }

      return eposResult.body;
    }

    // Non-EPOS providers not supported
    return reply.status(501).send({ 
      message: unsupportedProviderMessage("/api/payments/webhook") 
    });
  }
);

return app;
}

// Local dev: start the server when not running on Vercel
if (!process.env.VERCEL) {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}
