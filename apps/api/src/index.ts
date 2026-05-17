import Fastify from "fastify";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import Stripe from "stripe";
import { prisma, Prisma } from "./prisma.js";
import { getCheckoutSessionIdentifiers, shouldTreatWebhookEventAsDuplicate } from "./webhook/utils.js";
import { isPersistedDuplicateWebhookEvent } from "./webhook/persisted-dedupe.js";
import type { PaymentStatus } from "@prisma/client";

export async function buildApp() {

const app = Fastify({ logger: true });
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const paymentAlertWebhookUrl = process.env.PAYMENT_ALERT_WEBHOOK_URL?.trim() || undefined;
const disputeRateThresholdPercent = Number(process.env.DISPUTE_RATE_ALERT_THRESHOLD ?? "2");
const refundRateThresholdPercent = Number(process.env.REFUND_RATE_ALERT_THRESHOLD ?? "5");
const alertCooldownMs = Number(process.env.PAYMENT_ALERT_COOLDOWN_MS ?? String(1000 * 60 * 30));
const lastAlertByType = new Map<string, number>();
const webhookRateLimitStore = new Map<string, { count: number; resetAt: number }>();
const webhookRateLimit = Number(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE ?? "100");
const webhookRateWindowMs = 60 * 1000;
const processedWebhookEvents = new Map<string, number>();
const webhookEventTtlMs = Number(process.env.WEBHOOK_EVENT_TTL_MS ?? String(24 * 60 * 60 * 1000));
const settlementIdempotencyWindowMs = Number(
  process.env.DELIVERY_SETTLEMENT_IDEMPOTENCY_WINDOW_MS ?? String(7 * 24 * 60 * 60 * 1000)
);
const webhookAllowedIps = (process.env.STRIPE_WEBHOOK_ALLOWED_IPS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const metricsApiKey = process.env.METRICS_API_KEY?.trim() || "";

function getRequestIps(request: { ip: string; headers: Record<string, unknown> }) {
  const forwarded = request.headers["x-forwarded-for"];
  const fromForwarded = typeof forwarded === "string"
    ? forwarded
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  return [request.ip, ...fromForwarded].filter(Boolean);
}

function isWebhookIpAllowed(request: { ip: string; headers: Record<string, unknown> }) {
  if (webhookAllowedIps.length === 0) {
    return true;
  }

  const requestIps = getRequestIps(request);
  return requestIps.some((ip) => webhookAllowedIps.includes(ip));
}

function isWebhookRateLimited(ip: string, now = Date.now()) {
  const key = ip || "unknown";
  const current = webhookRateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    webhookRateLimitStore.set(key, {
      count: 1,
      resetAt: now + webhookRateWindowMs
    });
    return false;
  }

  if (current.count >= webhookRateLimit) {
    return true;
  }

  current.count += 1;
  webhookRateLimitStore.set(key, current);
  return false;
}

function isDuplicateWebhookEvent(eventId: string, now = Date.now()) {
  return shouldTreatWebhookEventAsDuplicate(processedWebhookEvents, eventId, webhookEventTtlMs, now);
}

async function isDuplicateWebhookEventInDatabase(event: Stripe.Event) {
  return isPersistedDuplicateWebhookEvent({
    hasDatabaseUrl,
    integrationEvent: prisma.integrationEvent,
    event,
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
        channel: "stripe",
        eventType: { contains: "charge.dispute" },
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
  if (!hasDatabaseUrl) {
    return {
      windowDays: days,
      generatedAt: new Date().toISOString(),
      kpis: {
        totalTransactions: 0,
        successfulTransactions: 0,
        refundedTransactions: 0,
        settledVolumeCents: 0,
        refundedVolumeCents: 0,
        disputeCount: 0,
        successRate: 0,
        refundRate: 0,
        disputeRate: 0,
        averagePaymentCents: 0,
        webhookEvents: 0,
        averageWebhookLatencyMs: 0,
        lastWebhookAt: null as string | null
      }
    };
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [payments, stripeEvents] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: { createdAt: { gte: since } },
      select: {
        amountCents: true,
        status: true,
        createdAt: true
      }
    }),
    prisma.integrationEvent.findMany({
      where: {
        channel: "stripe",
        createdAt: { gte: since }
      },
      select: {
        eventType: true,
        payload: true,
        createdAt: true
      }
    })
  ]);

  const totalTransactions = payments.length;
  const successfulTransactions = payments.filter((payment) => payment.status === "succeeded").length;
  const refundedTransactions = payments.filter(
    (payment) => payment.status === "refunded" || payment.status === "partially_refunded"
  ).length;

  const settledVolumeCents = payments
    .filter((payment) => ["succeeded", "refunded", "partially_refunded"].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  const refundedVolumeCents = payments
    .filter((payment) => payment.status === "refunded" || payment.status === "partially_refunded")
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  const disputeEvents = stripeEvents.filter((event) => event.eventType.includes("charge.dispute"));

  const webhookWithLatency = stripeEvents
    .map((event) => {
      const payload = event.payload as Record<string, unknown>;
      const updatedAt = typeof payload.updatedAt === "number" ? payload.updatedAt : null;
      if (!updatedAt) {
        return null;
      }

      const latencyMs = event.createdAt.getTime() - updatedAt * 1000;
      return latencyMs >= 0 ? latencyMs : null;
    })
    .filter((value): value is number => typeof value === "number");

  const averageWebhookLatencyMs =
    webhookWithLatency.length > 0
      ? Math.round(webhookWithLatency.reduce((sum, latency) => sum + latency, 0) / webhookWithLatency.length)
      : 0;

  const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;
  const refundRate = settledVolumeCents > 0 ? (refundedVolumeCents / settledVolumeCents) * 100 : 0;
  const disputeRate = totalTransactions > 0 ? (disputeEvents.length / totalTransactions) * 100 : 0;
  const averagePaymentCents = totalTransactions > 0 ? Math.round(settledVolumeCents / totalTransactions) : 0;

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    kpis: {
      totalTransactions,
      successfulTransactions,
      refundedTransactions,
      settledVolumeCents,
      refundedVolumeCents,
      disputeCount: disputeEvents.length,
      successRate,
      refundRate,
      disputeRate,
      averagePaymentCents,
      webhookEvents: stripeEvents.length,
      averageWebhookLatencyMs,
      lastWebhookAt: stripeEvents.length > 0 ? stripeEvents[stripeEvents.length - 1]?.createdAt.toISOString() ?? null : null
    }
  };
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
  stripeConfigured: Boolean(stripe),
  databaseConfigured: hasDatabaseUrl
}));

app.get("/api/health/stripe", async (_request, reply) => {
  if (!stripe) {
    return reply.status(503).send({
      status: "degraded",
      stripeConfigured: false,
      message: "Stripe is not configured"
    });
  }

  try {
    await stripe.balance.retrieve();
    return {
      status: "ok",
      stripeConfigured: true,
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return reply.status(502).send({
      status: "degraded",
      stripeConfigured: true,
      checkedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Stripe connectivity check failed"
    });
  }
});

app.get("/api/health/webhook", async () => {
  if (!hasDatabaseUrl) {
    return {
      status: "unknown",
      databaseConfigured: false,
      lastWebhookAt: null
    };
  }

  const latestWebhook = await prisma.integrationEvent.findFirst({
    where: { channel: "stripe" },
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
  priority: z.enum(["normal", "high"]).default("normal")
});

const createDeliveryActionRequestSchema = z.object({
  channel: z.enum(["doordash", "ubereats", "grubhub"]),
  action: z.enum(["accept", "reject", "cancel", "preparing", "ready", "out_for_delivery", "delivered"]),
  reason: z.string().max(240).optional()
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

function mapStripeStatusToPaymentStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
  const map: Record<Stripe.PaymentIntent.Status, PaymentStatus> = {
    requires_payment_method: "requires_payment_method",
    requires_confirmation: "requires_confirmation",
    requires_action: "requires_action",
    processing: "processing",
    requires_capture: "requires_capture",
    canceled: "canceled",
    succeeded: "succeeded"
  };

  return map[status] ?? "failed";
}

function normalizeDisputeStatus(status: Stripe.Dispute.Status): string {
  return status;
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

function isSupportedIntegrationChannel(channel: string): channel is (typeof integrationChannels)[number] {
  return integrationChannels.includes(channel as (typeof integrationChannels)[number]);
}

function stripKnownSignaturePrefixes(signature: string) {
  const trimmed = signature.trim();
  return trimmed.replace(/^(sha256=|v1=)/i, "");
}

function verifyHmacSha256Signature(input: {
  rawBody: string;
  signature: string;
  secret: string;
}) {
  const normalizedSignature = stripKnownSignaturePrefixes(input.signature);
  const computedSignature = createHmac("sha256", input.secret).update(input.rawBody, "utf8").digest("hex");

  const signatureBuffer = Buffer.from(normalizedSignature, "hex");
  const computedBuffer = Buffer.from(computedSignature, "hex");

  if (signatureBuffer.length === 0 || computedBuffer.length === 0) {
    return false;
  }

  if (signatureBuffer.length !== computedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, computedBuffer);
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

function hasDeliveryWebhookSignature(input: {
  channel: (typeof integrationChannels)[number];
  headers: Record<string, unknown>;
  rawBody: string;
}) {
  const configuredSecret = deliveryWebhookSecretByChannel[input.channel];
  if (!configuredSecret) {
    return false;
  }

  const providedSignatureRaw =
    (typeof input.headers["x-delivery-signature"] === "string" ? input.headers["x-delivery-signature"] : undefined) ??
    (typeof input.headers["x-signature"] === "string" ? input.headers["x-signature"] : undefined);

  if (!providedSignatureRaw || input.rawBody.length === 0) {
    return false;
  }

  return verifyHmacSha256Signature({
    rawBody: input.rawBody,
    signature: providedSignatureRaw,
    secret: configuredSecret
  });
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
      status: duplicateDispatch.status,
      createdAt: duplicateDispatch.createdAt.toISOString()
    };
  }

  await prisma.integrationEvent.create({
    data: {
      orderId: order.id,
      channel: parsed.data.channel,
      eventType: "delivery.dispatch.requested",
      status: "queued",
      payload: {
        dispatchId,
        orderId: order.id,
        priority: parsed.data.priority,
        amountCents: order.totalCents,
        queuedAt: new Date().toISOString()
      } as Prisma.InputJsonValue
    }
  });

  return {
    queued: true,
    dispatchId,
    channel: parsed.data.channel,
    orderId: order.id
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
      createdAt: duplicateAction.createdAt.toISOString()
    };
  }

  const mappedStatus = mapActionToProviderStatus[parsed.data.action];
  const event = await prisma.integrationEvent.create({
    data: {
      orderId: order.id,
      channel: parsed.data.channel,
      eventType: "delivery.order.action.requested",
      status: "queued",
      payload: {
        orderId: order.id,
        orderExternalId: order.externalOrderId ?? `${parsed.data.channel}:${order.id}`,
        action: parsed.data.action,
        mappedStatus,
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
    createdAt: event.createdAt.toISOString()
  };
});

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
    amountCents: z.number().int().min(1).optional()
  });

  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ message: "Invalid refund payload" });
  }

  if (!stripe) {
    return reply.status(500).send({ message: "Stripe is not configured" });
  }

  let refund: Stripe.Response<Stripe.Refund>;
  try {
    refund = await stripe.refunds.create({
      payment_intent: parsed.data.paymentIntentId,
      amount: parsed.data.amountCents
    });
  } catch (error) {
    await sendOperationalAlert({
      type: "refund_creation_failed",
      severity: "critical",
      message: "Stripe refund creation failed",
      details: {
        paymentIntentId: parsed.data.paymentIntentId,
        amountCents: parsed.data.amountCents,
        error: error instanceof Error ? error.message : "Unknown Stripe error"
      }
    });
    return reply.status(502).send({ message: "Stripe refund failed" });
  }

  request.log.info(
    {
      paymentIntentId: parsed.data.paymentIntentId,
      refundId: refund.id,
      amountCents: refund.amount,
      status: refund.status
    },
    "Refund processed"
  );

  if (hasDatabaseUrl) {
    const payment = await prisma.paymentTransaction.findUnique({
      where: { stripePaymentIntentId: parsed.data.paymentIntentId },
      select: { amountCents: true, orderId: true }
    });

    const targetAmount = payment?.amountCents ?? refund.amount;
    const nextStatus = refund.amount >= targetAmount ? "refunded" : "partially_refunded";

    await prisma.paymentTransaction.updateMany({
      where: { stripePaymentIntentId: parsed.data.paymentIntentId },
      data: { status: nextStatus }
    });

    await writeAdminAuditEvent({
      role,
      action: "payment_refund_created",
      entityId: parsed.data.paymentIntentId,
      entityType: "payment",
      orderId: payment?.orderId ?? undefined,
      payload: {
        refundId: refund.id,
        amountCents: refund.amount,
        status: refund.status
      }
    });

    await evaluateRiskThresholds("admin_refund_created");
  }

  return {
    refundId: refund.id,
    paymentIntentId: parsed.data.paymentIntentId,
    amountCents: refund.amount,
    status: refund.status
  };
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

  const disputes = await prisma.integrationEvent.findMany({
    where: {
      channel: "stripe",
      eventType: { contains: "charge.dispute" }
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      id: true,
      payload: true,
      status: true,
      createdAt: true
    }
  });

  return {
    data: disputes.map((event: { id: string; payload: unknown; status: string; createdAt: Date }) => {
      const payload = event.payload as Record<string, unknown>;
      return {
        id: event.id,
        disputeId: typeof payload.disputeId === "string" ? payload.disputeId : "unknown",
        paymentIntentId:
          typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : "unknown",
        amountCents: typeof payload.amountCents === "number" ? payload.amountCents : 0,
        currency: typeof payload.currency === "string" ? payload.currency : "usd",
        reason: typeof payload.reason === "string" ? payload.reason : "unknown",
        status: event.status,
        createdAt: event.createdAt
      };
    })
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
      where: {
        channel: "admin",
        eventType: "admin.payment_refund_created",
        createdAt: { gte: start, lt: end }
      },
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
    const amount = typeof payload.amountCents === "number" ? payload.amountCents : 0;
    return sum + amount;
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
        where: {
          channel: "admin",
          eventType: "admin.payment_refund_created",
          createdAt: { gte: start, lt: end }
        },
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
      const amount = typeof payload.amountCents === "number" ? payload.amountCents : 0;
      return sum + amount;
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

    if (isWebhookRateLimited(request.ip)) {
      return reply.status(429).send({ message: "Too many webhook requests" });
    }

    const raw = (request as typeof request & { rawBody?: string }).rawBody;
    if (!raw) {
      return reply.status(400).send({ message: "Missing webhook payload" });
    }

    if (!hasDeliveryWebhookSignature({ channel, headers: request.headers, rawBody: raw })) {
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

    const parsedBody = deliveryWebhookBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "Invalid delivery webhook payload",
        errors: parsedBody.error.flatten()
      });
    }

    const dedupeKey = `${channel}:${parsedBody.data.eventId}`;
    if (isDuplicateWebhookEvent(dedupeKey)) {
      return { received: true, duplicate: true };
    }

    const parsedDeliveryOrder = parseIncomingDeliveryOrder(parsedBody.data.payload, channel);
    const parsedStatusUpdate = parseIncomingDeliveryStatusUpdate(parsedBody.data.payload);
    const parsedSettlement = parseIncomingDeliverySettlement(parsedBody.data.payload);

    if (!hasDatabaseUrl) {
      return {
        received: true,
        channel,
        eventId: parsedBody.data.eventId,
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
        return { received: true, duplicate: true };
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
              settlementId: parsedSettlement.value.settlementId
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
              status: parsedStatusUpdate.value.status
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
          channel,
          eventType: parsedBody.data.eventType,
          status: ingestStatus,
          payload: {
            eventId: parsedBody.data.eventId,
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
                  currency: parsedSettlement.value.currency,
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

    return { received: true };
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
    if (isWebhookRateLimited(request.ip)) {
      request.log.warn({ ip: request.ip }, "Stripe webhook rate limit exceeded");
      return reply.status(429).send({ message: "Too many webhook requests" });
    }

    if (!isWebhookIpAllowed(request)) {
      request.log.warn(
        {
          requestIp: request.ip,
          requestIps: getRequestIps(request),
        },
        "Stripe webhook blocked by IP allowlist"
      );
      await sendOperationalAlert({
        type: "webhook_ip_not_allowed",
        severity: "critical",
        message: "Stripe webhook request blocked by IP allowlist",
        details: {
          requestIp: request.ip,
          requestIps: getRequestIps(request),
        }
      });
      return reply.status(403).send({ message: "Webhook IP not allowed" });
    }

    const signature = request.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !signature || !webhookSecret) {
      await sendOperationalAlert({
        type: "webhook_misconfigured",
        severity: "critical",
        message: "Stripe webhook received while webhook configuration is incomplete",
        details: {
          stripeConfigured: Boolean(stripe),
          hasSignature: Boolean(signature),
          hasWebhookSecret: Boolean(webhookSecret)
        }
      });
      return reply.status(400).send({ message: "Webhook is not configured" });
    }

    const raw = (request as typeof request & { rawBody?: string }).rawBody;
    if (!raw) {
      return reply.status(400).send({ message: "Missing webhook payload" });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
    } catch (error) {
      request.log.warn({ error }, "Invalid Stripe webhook signature");
      await sendOperationalAlert({
        type: "webhook_signature_invalid",
        severity: "critical",
        message: "Stripe webhook signature verification failed",
        details: {
          error: error instanceof Error ? error.message : "Invalid signature"
        }
      });
      return reply.status(400).send({ message: "Invalid signature" });
    }

    if (isDuplicateWebhookEvent(event.id)) {
      request.log.info({ eventId: event.id, eventType: event.type }, "Duplicate Stripe webhook event ignored");
      return { received: true, duplicate: true };
    }

    if (hasDatabaseUrl) {
      try {
        const isPersistedDuplicate = await isDuplicateWebhookEventInDatabase(event);
        if (isPersistedDuplicate) {
          request.log.info(
            { eventId: event.id, eventType: event.type },
            "Duplicate Stripe webhook event ignored via persisted lookup"
          );
          return { received: true, duplicate: true };
        }
      } catch (error) {
        request.log.error(
          { 
            error, 
            eventId: event.id, 
            eventType: event.type,
            alertType: 'duplicate_check_failure',
            severity: 'high',
            impact: 'potential_duplicate_processing'
          }, 
          "ALERT: Failed persisted webhook duplicate check; continuing with processing - potential duplicate events may be processed"
        );
      }
    }

    if (event.type === "checkout.session.completed") {
      const completedSession = event.data.object as Stripe.Checkout.Session;

      if (hasDatabaseUrl) {
        try {
          const { stripeCustomerId, paymentIntentId, orderId } = getCheckoutSessionIdentifiers(completedSession);

          const writeCheckoutEvent = async (
            status: string,
            details: Record<string, unknown>
          ) => {
            await prisma.integrationEvent.create({
              data: {
                orderId,
                channel: "stripe",
                eventType: event.type,
                status,
                payload: {
                  eventId: event.id,
                  sessionId: completedSession.id,
                  stripeCustomerId: stripeCustomerId ?? null,
                  paymentIntentId: paymentIntentId ?? null,
                  ...details
                } as Prisma.InputJsonValue
              }
            });
          };

          if (!stripeCustomerId || !paymentIntentId) {
            await writeCheckoutEvent("ignored", {
              reason: "missing_customer_or_payment_intent"
            });
            return { received: true };
          }

          const customer = await prisma.customer.findFirst({
            where: { stripeCustomerId },
            select: {
              id: true,
              defaultPaymentMethodId: true
            }
          });

          if (!customer) {
            await writeCheckoutEvent("ignored", {
              reason: "customer_not_found"
            });
            return { received: true };
          }

          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ["payment_method"]
          });

          const paymentMethod =
            typeof paymentIntent.payment_method === "string"
              ? await stripe.paymentMethods.retrieve(paymentIntent.payment_method)
              : paymentIntent.payment_method;

          if (!paymentMethod || paymentMethod.type !== "card" || !paymentMethod.card) {
            await writeCheckoutEvent("ignored", {
              reason: "unsupported_or_missing_payment_method",
              paymentMethodType: paymentMethod?.type ?? null
            });
            return { received: true };
          }

          const shouldBeDefault = !customer.defaultPaymentMethodId;

          request.log.info(
            {
              eventType: event.type,
              stripeCustomerId,
              paymentIntentId
            },
            "Processing completed checkout session"
          );

          await prisma.$transaction(async (tx) => {
            if (shouldBeDefault) {
              await tx.savedPaymentMethod.updateMany({
                where: { customerId: customer.id },
                data: { isDefault: false }
              });
            }

            await tx.savedPaymentMethod.upsert({
              where: { stripePaymentMethodId: paymentMethod.id },
              update: {
                brand: paymentMethod.card?.brand ?? "card",
                last4: paymentMethod.card?.last4 ?? "0000",
                expMonth: paymentMethod.card?.exp_month ?? 1,
                expYear: paymentMethod.card?.exp_year ?? 1970,
                isDefault: shouldBeDefault
              },
              create: {
                customerId: customer.id,
                stripePaymentMethodId: paymentMethod.id,
                brand: paymentMethod.card?.brand ?? "card",
                last4: paymentMethod.card?.last4 ?? "0000",
                expMonth: paymentMethod.card?.exp_month ?? 1,
                expYear: paymentMethod.card?.exp_year ?? 1970,
                isDefault: shouldBeDefault
              }
            });

            if (shouldBeDefault) {
              await tx.customer.update({
                where: { id: customer.id },
                data: { defaultPaymentMethodId: paymentMethod.id }
              });
            }
          });

          await writeCheckoutEvent("processed", {
            customerId: customer.id,
            stripePaymentMethodId: paymentMethod.id,
            shouldSetDefault: shouldBeDefault
          });
        } catch (error) {
          request.log.error({ error }, "Failed to sync checkout session payment method");
          await sendOperationalAlert({
            type: "checkout_session_sync_failed",
            severity: "critical",
            message: "Checkout session webhook synchronization failed",
            details: {
              eventType: event.type,
              error: error instanceof Error ? error.message : "Unknown processing error"
            }
          });
          return reply.status(500).send({ message: "Webhook processing failed" });
        }
      }
    }

    if (event.type.startsWith("payment_intent.")) {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      if (hasDatabaseUrl) {
        try {
          const orderId = typeof paymentIntent.metadata.orderId === "string" && paymentIntent.metadata.orderId
            ? paymentIntent.metadata.orderId
            : undefined;
          const bookingId =
            typeof paymentIntent.metadata.bookingId === "string" && paymentIntent.metadata.bookingId
              ? paymentIntent.metadata.bookingId
              : undefined;
          const paymentType =
            typeof paymentIntent.metadata.paymentType === "string" && paymentIntent.metadata.paymentType
              ? paymentIntent.metadata.paymentType
              : "order";

          request.log.info(
            {
              eventType: event.type,
              paymentIntentId: paymentIntent.id,
              amountCents: paymentIntent.amount,
              status: paymentIntent.status,
              orderId,
              bookingId,
              paymentType
            },
            "Reconciling payment intent webhook"
          );

          await prisma.paymentTransaction.upsert({
            where: { stripePaymentIntentId: paymentIntent.id },
            update: {
              amountCents: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: mapStripeStatusToPaymentStatus(paymentIntent.status),
              orderId,
              bookingId,
              paymentType
            },
            create: {
              stripePaymentIntentId: paymentIntent.id,
              amountCents: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: mapStripeStatusToPaymentStatus(paymentIntent.status),
              orderId,
              bookingId,
              paymentType
            }
          });

          if (orderId) {
            await prisma.order.update({
              where: { id: orderId },
              data: { stripeIntentId: paymentIntent.id }
            });
          }

          await prisma.integrationEvent.create({
            data: {
              orderId,
              channel: "stripe",
              eventType: event.type,
              status: "processed",
              payload: {
                eventId: event.id,
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status
              } as Prisma.InputJsonValue
            }
          });
        } catch (error) {
          request.log.error({ error }, "Failed to reconcile payment intent webhook");
          await sendOperationalAlert({
            type: "payment_intent_reconcile_failed",
            severity: "critical",
            message: "Payment intent webhook reconciliation failed",
            details: {
              eventType: event.type,
              paymentIntentId: paymentIntent.id,
              error: error instanceof Error ? error.message : "Unknown processing error"
            }
          });
          return reply.status(500).send({ message: "Webhook processing failed" });
        }
      }
    }

    if (event.type.startsWith("charge.dispute.")) {
      const dispute = event.data.object as Stripe.Dispute;

      if (hasDatabaseUrl) {
        try {
          const paymentIntentId =
            typeof dispute.payment_intent === "string" ? dispute.payment_intent : undefined;
          const disputeStatus = normalizeDisputeStatus(dispute.status);

          request.log.info(
            {
              eventType: event.type,
              disputeId: dispute.id,
              paymentIntentId,
              disputeStatus,
              amountCents: dispute.amount,
              reason: dispute.reason
            },
            "Reconciling dispute webhook"
          );

          const linkedPayment = paymentIntentId
            ? await prisma.paymentTransaction.findUnique({
                where: { stripePaymentIntentId: paymentIntentId },
                select: { orderId: true }
              })
            : null;

          if (disputeStatus === "lost" && paymentIntentId) {
            await prisma.paymentTransaction.updateMany({
              where: { stripePaymentIntentId: paymentIntentId },
              data: { status: "failed" }
            });
          }

          const recentDisputeEvents = await prisma.integrationEvent.findMany({
            where: {
              channel: "stripe",
              eventType: { contains: "charge.dispute" }
            },
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
              id: true,
              payload: true
            }
          });

          const existing = recentDisputeEvents.find((candidate) => {
            const payload = candidate.payload as Record<string, unknown>;
            return payload.disputeId === dispute.id;
          });

          const nextPayload = {
            ...(existing ? (existing.payload as Record<string, unknown>) : {}),
            eventId: event.id,
            disputeId: dispute.id,
            paymentIntentId: paymentIntentId ?? "unknown",
            amountCents: dispute.amount,
            currency: dispute.currency,
            reason: dispute.reason,
            disputeStatus,
            evidenceDueBy: dispute.evidence_details?.due_by ?? null,
            updatedAt: event.created,
            evidenceDetails: JSON.parse(JSON.stringify(dispute.evidence_details ?? {}))
          } as Prisma.InputJsonValue;

          if (existing) {
            await prisma.integrationEvent.update({
              where: { id: existing.id },
              data: {
                orderId: linkedPayment?.orderId,
                eventType: event.type,
                status: disputeStatus,
                payload: nextPayload
              }
            });
          } else {
            await prisma.integrationEvent.create({
              data: {
                orderId: linkedPayment?.orderId,
                channel: "stripe",
                eventType: event.type,
                status: disputeStatus,
                payload: nextPayload
              }
            });
          }

          await evaluateRiskThresholds("dispute_webhook_event");
        } catch (error) {
          request.log.error({ error }, "Failed to persist dispute webhook event");
          await sendOperationalAlert({
            type: "dispute_reconcile_failed",
            severity: "critical",
            message: "Dispute webhook reconciliation failed",
            details: {
              eventType: event.type,
              disputeId: dispute.id,
              error: error instanceof Error ? error.message : "Unknown processing error"
            }
          });
          return reply.status(500).send({ message: "Webhook processing failed" });
        }
      }
    }

    return { received: true };
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
