import { createHmac } from "node:crypto";
import type { PaymentStatus } from "@prisma/client";
import {
  EPOS_WEBHOOK_EVENT_NAME_BY_TYPE,
  mapEposTransactionStatusToPaymentStatus,
  parseEposWebhookPayload,
} from "./epos";

type EposWebhookRequestLike = {
  ip: string;
  headers: Record<string, unknown>;
  rawBody?: string;
  correlationId: string;
};

type EposWebhookLoggerLike = {
  warn: (payload: Record<string, unknown>, message: string) => void;
  info: (payload: Record<string, unknown>, message: string) => void;
};

type EposOrderStore = {
  updateMany: (args: {
    where: { id: string };
    data: { status: "confirmed"; correlationId: string };
  }) => Promise<unknown>;
};

type EposPaymentTransactionStore = {
  upsert: (args: {
    where: Record<string, unknown>;
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }) => Promise<unknown>;
};

type EposIntegrationEventStore = {
  create: (args: {
    data: {
      orderId?: string;
      correlationId: string;
      channel: "epos";
      eventType: string;
      status: "processed";
      payload: Record<string, unknown>;
    };
  }) => Promise<unknown>;
};

type EposWebhookPrismaLike = {
  order: EposOrderStore;
  paymentTransaction: EposPaymentTransactionStore;
  integrationEvent: EposIntegrationEventStore;
};

type EposWebhookAlertInput = {
  type: string;
  severity: "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
};

type HandleEposWebhookInput = {
  request: EposWebhookRequestLike;
  logger: EposWebhookLoggerLike;
  allowedIps: string[];
  signatureHeader: string;
  webhookSecret?: string;
  requireSignature: boolean;
  hasDatabaseUrl: boolean;
  prisma: EposWebhookPrismaLike;
  isWebhookRateLimited: (ip: string) => Promise<boolean>;
  isWebhookIpAllowed: (
    request: { ip: string; headers: Record<string, unknown> },
    allowedIps: string[]
  ) => boolean;
  getRequestIps: (request: { ip: string; headers: Record<string, unknown> }) => string[];
  verifyHmacSha256Signature: (input: {
    rawBody: string;
    signature: string;
    secret: string;
  }) => boolean;
  isDuplicateWebhookEvent: (eventId: string) => Promise<boolean>;
  isPersistedDuplicateWebhookEvent?: (input: {
    eventId: string;
    eventTypeName: string;
  }) => Promise<boolean>;
  sendOperationalAlert: (input: EposWebhookAlertInput) => Promise<void>;
};

type EposWebhookResult = {
  statusCode: number;
  body: Record<string, unknown>;
};

function buildEposWebhookEventName(eventType: number | undefined) {
  if (typeof eventType !== "number") {
    return "Unknown";
  }

  return EPOS_WEBHOOK_EVENT_NAME_BY_TYPE[eventType] ?? `Unknown-${eventType}`;
}

function toPaymentAmountCents(totalAmount: number | undefined) {
  if (typeof totalAmount !== "number") {
    return null;
  }

  return Math.max(0, Math.round(totalAmount * 100));
}

export async function handleEposWebhook(input: HandleEposWebhookInput): Promise<EposWebhookResult> {
  const { request, logger } = input;
  const correlationId = request.correlationId;

  if (await input.isWebhookRateLimited(request.ip)) {
    logger.warn({ ip: request.ip, correlationId }, "EPOS webhook rate limit exceeded");
    return { statusCode: 429, body: { message: "Too many webhook requests" } };
  }

  if (!input.isWebhookIpAllowed(request, input.allowedIps)) {
    const requestIps = input.getRequestIps(request);
    logger.warn(
      {
        requestIp: request.ip,
        requestIps,
        correlationId,
      },
      "EPOS webhook blocked by IP allowlist"
    );

    await input.sendOperationalAlert({
      type: "epos_webhook_ip_not_allowed",
      severity: "critical",
      message: "EPOS webhook request blocked by IP allowlist",
      details: {
        requestIp: request.ip,
        requestIps,
        correlationId,
      },
    });

    return { statusCode: 403, body: { message: "Webhook IP not allowed" } };
  }

  const raw = request.rawBody;
  if (!raw) {
    return { statusCode: 400, body: { message: "Missing webhook payload" } };
  }

  const signatureHeaderValue = request.headers[input.signatureHeader];
  const providedSignature = typeof signatureHeaderValue === "string" ? signatureHeaderValue : undefined;

  if (input.requireSignature) {
    if (!input.webhookSecret || !providedSignature) {
      await input.sendOperationalAlert({
        type: "epos_webhook_misconfigured",
        severity: "critical",
        message: "EPOS webhook received while signature configuration is incomplete",
        details: {
          hasWebhookSecret: Boolean(input.webhookSecret),
          hasSignature: Boolean(providedSignature),
          correlationId,
        },
      });

      return { statusCode: 400, body: { message: "Webhook is not configured" } };
    }

    if (!input.verifyHmacSha256Signature({ rawBody: raw, signature: providedSignature, secret: input.webhookSecret })) {
      await input.sendOperationalAlert({
        type: "epos_webhook_signature_invalid",
        severity: "critical",
        message: "EPOS webhook signature verification failed",
        details: { correlationId },
      });

      return { statusCode: 401, body: { message: "Invalid signature" } };
    }
  }

  const parsedPayload = parseEposWebhookPayload(raw);
  if (!parsedPayload) {
    return { statusCode: 400, body: { message: "Invalid webhook payload" } };
  }

  const eventId =
    parsedPayload.eventId ??
    createHmac("sha256", "epos-webhook-fallback")
      .update(raw, "utf8")
      .digest("hex");

  if (await input.isDuplicateWebhookEvent(`epos:${eventId}`)) {
    logger.info(
      { eventId, eventType: parsedPayload.eventType ?? "unknown", correlationId },
      "Duplicate EPOS webhook event ignored"
    );

    return {
      statusCode: 200,
      body: { received: true, duplicate: true, correlationId },
    };
  }

  const eventTypeName = buildEposWebhookEventName(parsedPayload.eventType);

  if (input.isPersistedDuplicateWebhookEvent && input.hasDatabaseUrl) {
    try {
      const isPersistedDuplicate = await input.isPersistedDuplicateWebhookEvent({
        eventId,
        eventTypeName,
      });

      if (isPersistedDuplicate) {
        logger.info(
          { eventId, eventType: parsedPayload.eventType ?? "unknown", correlationId },
          "Duplicate EPOS webhook event ignored via persisted lookup"
        );

        return {
          statusCode: 200,
          body: { received: true, duplicate: true, correlationId },
        };
      }
    } catch (error) {
      logger.warn(
        {
          eventId,
          eventType: parsedPayload.eventType ?? "unknown",
          correlationId,
          error: error instanceof Error ? error.message : "unknown_error",
        },
        "EPOS persisted webhook duplicate check failed; continuing processing"
      );

      await input.sendOperationalAlert({
        type: "epos_webhook_duplicate_check_failed",
        severity: "warning",
        message: "EPOS webhook persisted duplicate check failed",
        details: {
          eventId,
          eventTypeName,
          correlationId,
          error: error instanceof Error ? error.message : "unknown_error",
        },
      });
    }
  }

  const paymentStatus: PaymentStatus = mapEposTransactionStatusToPaymentStatus({
    eventType: parsedPayload.eventType,
    statusId: parsedPayload.statusId,
  });
  const isCompleted = paymentStatus === "succeeded";
  const amountCents = toPaymentAmountCents(parsedPayload.totalAmount);

  if (input.hasDatabaseUrl) {
    const referenceCode = parsedPayload.referenceCode;
    const bookingId =
      referenceCode && referenceCode.startsWith("booking:")
        ? referenceCode.slice("booking:".length)
        : undefined;
    const orderId = referenceCode && !bookingId ? referenceCode : undefined;

    if (orderId && isCompleted) {
      await input.prisma.order.updateMany({
        where: { id: orderId },
        data: {
          status: "confirmed",
          correlationId,
        },
      });

      if (typeof amountCents === "number") {
        await input.prisma.paymentTransaction.upsert({
          where: { orderId },
          update: {
            amountCents,
            status: paymentStatus,
            currency: "usd",
            correlationId,
          },
          create: {
            orderId,
            amountCents,
            status: paymentStatus,
            currency: "usd",
            paymentType: "order",
            stripePaymentIntentId: `epos_txn_${eventId}`,
            correlationId,
          },
        });
      }
    }

    if (bookingId && typeof amountCents === "number") {
      await input.prisma.paymentTransaction.upsert({
        where: { stripePaymentIntentId: `epos_txn_${eventId}` },
        update: {
          bookingId,
          amountCents,
          status: paymentStatus,
          currency: "usd",
          paymentType: "deposit",
          correlationId,
        },
        create: {
          bookingId,
          amountCents,
          status: paymentStatus,
          currency: "usd",
          paymentType: "deposit",
          stripePaymentIntentId: `epos_txn_${eventId}`,
          correlationId,
        },
      });
    }

    await input.prisma.integrationEvent.create({
      data: {
        orderId,
        correlationId,
        channel: "epos",
        eventType: `epos.webhook.${eventTypeName}`,
        status: "processed",
        payload: {
          eventId,
          eventType: parsedPayload.eventType ?? null,
          eventTypeName,
          referenceCode: parsedPayload.referenceCode ?? null,
          statusId: parsedPayload.statusId ?? null,
          totalAmount: parsedPayload.totalAmount ?? null,
          paymentStatus,
          rawPayload: parsedPayload.payload,
        },
      },
    });
  }

  return {
    statusCode: 200,
    body: { received: true, provider: "epos", correlationId },
  };
}
