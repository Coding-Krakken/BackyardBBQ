import { prisma, Prisma } from "@bbq/database";
import {
  createDeliveryChannelAdapters,
  deliveryChannels,
  type DeliveryChannel,
  type InboundOrderEnvelope,
  type DeliveryProviderCredentials,
  type ProviderStatusSyncInput
} from "@bbq/delivery-channels";
import { deliveryProviderCredentialSchema } from "@bbq/domain";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
function readChannelCredentials(channel: DeliveryChannel): DeliveryProviderCredentials {
  const upper = channel.toUpperCase();

  const candidate: DeliveryProviderCredentials = {
    apiKey: process.env[`${upper}_API_KEY`] ?? "",
    apiSecret: process.env[`${upper}_API_SECRET`],
    webhookSecret: process.env[`${upper}_WEBHOOK_SECRET`],
    merchantId: process.env[`${upper}_MERCHANT_ID`],
    storeId: process.env[`${upper}_STORE_ID`],
    environment:
      process.env[`${upper}_ENVIRONMENT`] === "production" ? "production" : "sandbox"
  };

  const parsed = deliveryProviderCredentialSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    apiKey: candidate.apiKey,
    apiSecret: candidate.apiSecret,
    webhookSecret: candidate.webhookSecret,
    merchantId: candidate.merchantId,
    storeId: candidate.storeId,
    environment: candidate.environment
  };
}

const adapters = createDeliveryChannelAdapters({
  retryPolicy: {
    maxAttempts: 3,
    backoffBaseMs: 140,
    backoffMultiplier: 2
  },
  credentialsByChannel: {
    doordash: readChannelCredentials("doordash"),
    ubereats: readChannelCredentials("ubereats"),
    grubhub: readChannelCredentials("grubhub")
  }
});
const fallbackQueue = new Map<DeliveryChannel, InboundOrderEnvelope[]>();

deliveryChannels.forEach((channel) => {
  fallbackQueue.set(channel, []);
});

let sequence = 0;
let lastOutboundSyncAt = new Date(0);

type IncomingWebhookOrder = {
  externalOrderId: string;
  source: DeliveryChannel;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
    notes?: string;
  }>;
};

type IncomingWebhookStatusUpdate = {
  internalOrderId?: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
};

function mapInternalToProviderStatus(status: string): ProviderStatusSyncInput["status"] | null {
  switch (status) {
    case "confirmed":
      return "accepted";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "completed":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

function getPayloadCorrelationId(payload: Prisma.JsonObject, fallback: string) {
  const correlationId = payload.correlationId;
  return typeof correlationId === "string" && correlationId.length > 0 ? correlationId : fallback;
}

function getEventCorrelationId(
  event: { correlationId?: string | null; payload: Prisma.JsonValue },
  fallback: string
) {
  if (typeof event.correlationId === "string" && event.correlationId.length > 0) {
    return event.correlationId;
  }

  const payload = event.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  return getPayloadCorrelationId(payload as Prisma.JsonObject, fallback);
}

function parseWebhookOrderPayload(payload: Prisma.JsonObject): IncomingWebhookOrder | null {
  const orderValue = payload.order;
  if (!orderValue || typeof orderValue !== "object" || Array.isArray(orderValue)) {
    return null;
  }

  const order = orderValue as Prisma.JsonObject;
  const externalOrderId = typeof order.externalOrderId === "string" ? order.externalOrderId : null;
  const source = typeof order.source === "string" ? (order.source as DeliveryChannel) : null;
  const subtotalCents = typeof order.subtotalCents === "number" ? order.subtotalCents : null;
  const taxCents = typeof order.taxCents === "number" ? order.taxCents : 0;
  const tipCents = typeof order.tipCents === "number" ? order.tipCents : 0;
  const totalCents = typeof order.totalCents === "number" ? order.totalCents : null;
  const itemsValue = order.items;

  if (!externalOrderId || !source || !deliveryChannels.includes(source) || subtotalCents === null || totalCents === null) {
    return null;
  }

  if (!Array.isArray(itemsValue) || itemsValue.length === 0) {
    return null;
  }

  const items: IncomingWebhookOrder["items"] = [];
  for (const item of itemsValue) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const row = item as Prisma.JsonObject;
    const name = typeof row.name === "string" ? row.name : null;
    const quantity = typeof row.quantity === "number" ? row.quantity : null;
    const unitPriceCents = typeof row.unitPriceCents === "number" ? row.unitPriceCents : null;
    const notes = typeof row.notes === "string" ? row.notes : undefined;

    if (!name || quantity === null || unitPriceCents === null) {
      continue;
    }

    items.push({ name, quantity, unitPriceCents, notes });
  }

  if (items.length === 0) {
    return null;
  }

  return {
    externalOrderId,
    source,
    subtotalCents,
    taxCents,
    tipCents,
    totalCents,
    items
  };
}

function parseWebhookStatusPayload(payload: Prisma.JsonObject): IncomingWebhookStatusUpdate | null {
  const statusValue = payload.statusUpdate;
  if (!statusValue || typeof statusValue !== "object" || Array.isArray(statusValue)) {
    return null;
  }

  const statusUpdate = statusValue as Prisma.JsonObject;
  const status = typeof statusUpdate.status === "string" ? statusUpdate.status : null;
  const internalOrderId =
    typeof statusUpdate.internalOrderId === "string" ? statusUpdate.internalOrderId : undefined;

  if (
    status !== "pending" &&
    status !== "confirmed" &&
    status !== "preparing" &&
    status !== "ready" &&
    status !== "completed" &&
    status !== "cancelled"
  ) {
    return null;
  }

  return {
    internalOrderId,
    status
  };
}

async function getDefaultLocationId() {
  const location = await prisma.location.findFirst({
    where: { isActive: true },
    select: { id: true }
  });

  return location?.id ?? null;
}

async function runWebhookOrderQueueCycle() {
  if (!hasDatabaseUrl) {
    return;
  }

  const queuedEvents = await prisma.integrationEvent.findMany({
    where: {
      eventType: "delivery.webhook.order.received",
      status: { in: ["queued", "pending"] }
    },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  for (const webhookEvent of queuedEvents) {
    const channel = webhookEvent.channel as DeliveryChannel;
    const payload = webhookEvent.payload as Prisma.JsonObject;
    const correlationId = getEventCorrelationId(webhookEvent, `wh-order-${webhookEvent.id}`);
    const parsedOrder = parseWebhookOrderPayload(payload);

    if (!parsedOrder) {
      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: "invalid_webhook_order_payload",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    if (parsedOrder.source !== channel) {
      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: "channel_source_mismatch",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    const locationId = await getDefaultLocationId();
    if (!locationId) {
      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: "no_active_location",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    try {
      const existing = await prisma.order.findFirst({
        where: {
          externalChannel: channel,
          externalOrderId: parsedOrder.externalOrderId
        },
        select: {
          id: true,
          totalCents: true
        }
      });

      if (!existing) {
        await prisma.order.create({
          data: {
            locationId,
            correlationId,
            source: channel,
            status: "pending",
            externalChannel: channel,
            externalOrderId: parsedOrder.externalOrderId,
            subtotalCents: parsedOrder.subtotalCents,
            taxCents: parsedOrder.taxCents,
            tipCents: parsedOrder.tipCents,
            totalCents: parsedOrder.totalCents,
            items: {
              create: parsedOrder.items.map((item) => ({
                menuItemName: item.name,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
                notes: item.notes
              }))
            }
          }
        });
      }

      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          correlationId,
          status: "processed",
          payload: {
            ...payload,
            correlationId,
            processedAt: new Date().toISOString(),
            duplicateOrder: Boolean(existing)
          }
        }
      });
    } catch (error) {
      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          correlationId,
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: error instanceof Error ? error.message : "webhook_order_processing_failed",
            failedAt: new Date().toISOString()
          }
        }
      });
    }
  }
}

async function runWebhookStatusQueueCycle() {
  if (!hasDatabaseUrl) {
    return;
  }

  const queuedEvents = await prisma.integrationEvent.findMany({
    where: {
      eventType: "delivery.webhook.status.received",
      status: { in: ["queued", "pending"] }
    },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  for (const webhookEvent of queuedEvents) {
    const channel = webhookEvent.channel as DeliveryChannel;
    const payload = webhookEvent.payload as Prisma.JsonObject;
    const correlationId = getEventCorrelationId(webhookEvent, `wh-status-${webhookEvent.id}`);
    const parsedStatus = parseWebhookStatusPayload(payload);
    const orderExternalId = typeof payload.orderExternalId === "string" ? payload.orderExternalId : undefined;

    if (!parsedStatus) {
      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: "invalid_webhook_status_payload",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    const order = parsedStatus.internalOrderId
      ? await prisma.order.findUnique({
          where: { id: parsedStatus.internalOrderId },
          select: { id: true, status: true, source: true, externalOrderId: true }
        })
      : orderExternalId
        ? await prisma.order.findFirst({
            where: {
              externalChannel: channel,
              externalOrderId: orderExternalId
            },
            select: { id: true, status: true, source: true, externalOrderId: true }
          })
        : null;

    if (!order) {
      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: "order_not_found_for_status",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    if (order.source !== channel) {
      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: "status_channel_source_mismatch",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    try {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: parsedStatus.status,
          correlationId
        }
      });

      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          orderId: order.id,
          correlationId,
          status: "processed",
          payload: {
            ...payload,
            correlationId,
            previousStatus: order.status,
            appliedStatus: parsedStatus.status,
            processedAt: new Date().toISOString()
          }
        }
      });

      await persistStatusSyncEvent({
        channel,
        status: "processed",
        payload: {
          orderId: order.id,
          externalOrderId: order.externalOrderId,
          mappedStatus: parsedStatus.status,
          correlationId,
          sourceEventId: webhookEvent.id,
          direction: "inbound_webhook",
          syncedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      await prisma.integrationEvent.update({
        where: { id: webhookEvent.id },
        data: {
          correlationId,
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: error instanceof Error ? error.message : "webhook_status_processing_failed",
            failedAt: new Date().toISOString()
          }
        }
      });
    }
  }
}

async function persistHealthEvent(input: {
  channel: DeliveryChannel;
  status: "healthy" | "degraded" | "down";
  processedCount: number;
  failedCount: number;
  deadLetterCount: number;
  latencyMs: number;
}) {
  if (!hasDatabaseUrl) {
    return;
  }

  const correlationId =
    typeof input.channel === "string" ? `health-${input.channel}-${Date.now()}` : `health-${Date.now()}`;

  await prisma.integrationEvent.create({
    data: {
      correlationId,
      channel: input.channel,
      eventType: "delivery.sync.health",
      status: input.status,
      payload: {
        correlationId,
        processedCount: input.processedCount,
        failedCount: input.failedCount,
        deadLetterCount: input.deadLetterCount,
        latencyMs: input.latencyMs,
        recordedAt: new Date().toISOString()
      }
    }
  });
}

async function persistDeadLetter(input: {
  channel: DeliveryChannel;
  reason: string;
  orderExternalId: string;
}) {
  if (!hasDatabaseUrl) {
    return;
  }

  const correlationId = `dead-letter-${input.channel}-${Date.now()}`;

  await prisma.integrationEvent.create({
    data: {
      correlationId,
      channel: input.channel,
      eventType: "delivery.order.sync",
      status: "dead_letter",
      payload: {
        correlationId,
        reason: input.reason,
        orderExternalId: input.orderExternalId,
        capturedAt: new Date().toISOString()
      }
    }
  });
}

async function persistIngestEvent(input: {
  channel: DeliveryChannel;
  eventType: string;
  status: string;
  payload: Record<string, unknown>;
}) {
  if (!hasDatabaseUrl) {
    return;
  }

  const correlationId =
    typeof input.payload.correlationId === "string" && input.payload.correlationId.length > 0
      ? input.payload.correlationId
      : `ingest-${input.channel}-${Date.now()}`;

  await prisma.integrationEvent.create({
    data: {
      correlationId,
      channel: input.channel,
      eventType: input.eventType,
      status: input.status,
      payload: {
        ...input.payload,
        correlationId
      } as Prisma.InputJsonValue
    }
  });
}

async function persistStatusSyncEvent(input: {
  channel: DeliveryChannel;
  status: string;
  payload: Record<string, unknown>;
}) {
  if (!hasDatabaseUrl) {
    return;
  }

  const correlationId =
    typeof input.payload.correlationId === "string" && input.payload.correlationId.length > 0
      ? input.payload.correlationId
      : `status-sync-${input.channel}-${Date.now()}`;

  await prisma.integrationEvent.create({
    data: {
      correlationId,
      channel: input.channel,
      eventType: "delivery.order.status.sync",
      status: input.status,
      payload: {
        ...input.payload,
        correlationId
      } as Prisma.InputJsonValue
    }
  });
}

async function persistSettlementSyncEvent(input: {
  channel: DeliveryChannel;
  status: string;
  payload: Record<string, unknown>;
}) {
  if (!hasDatabaseUrl) {
    return;
  }

  const correlationId =
    typeof input.payload.correlationId === "string" && input.payload.correlationId.length > 0
      ? input.payload.correlationId
      : `settlement-sync-${input.channel}-${Date.now()}`;

  await prisma.integrationEvent.create({
    data: {
      correlationId,
      channel: input.channel,
      eventType: "delivery.settlement.sync",
      status: input.status,
      payload: {
        ...input.payload,
        correlationId
      } as Prisma.InputJsonValue
    }
  });
}

function toUtcDayBounds(dateInput: Date) {
  const periodStart = new Date(dateInput);
  periodStart.setUTCHours(0, 0, 0, 0);

  const periodEnd = new Date(dateInput);
  periodEnd.setUTCHours(23, 59, 59, 999);

  return { periodStart, periodEnd };
}

async function persistSettlementLedgerRecord(input: {
  channel: DeliveryChannel;
  settlementId: string;
  payoutId?: string;
  externalOrderId: string;
  grossCents: number;
  feesCents: number;
  netCents: number;
  currency: string;
  settledAt: string;
}) {
  if (!hasDatabaseUrl) {
    return null;
  }

  const settledAtDate = new Date(input.settledAt);
  const effectiveSettledAt = Number.isNaN(settledAtDate.getTime()) ? new Date() : settledAtDate;
  const { periodStart, periodEnd } = toUtcDayBounds(effectiveSettledAt);

  const matchingOrder = await prisma.order.findFirst({
    where: {
      externalChannel: input.channel,
      externalOrderId: input.externalOrderId
    },
    select: {
      id: true,
      locationId: true
    }
  });

  const fallbackLocationId = matchingOrder ? null : await getDefaultLocationId();
  const locationId = matchingOrder?.locationId ?? fallbackLocationId;
  if (!locationId) {
    throw new Error("no_active_location_for_settlement");
  }

  const settlementBatch = await prisma.deliverySettlementBatch.upsert({
    where: {
      channel_externalBatchId: {
        channel: input.channel,
        externalBatchId: input.settlementId
      }
    },
    update: {
      locationId,
      periodStart,
      periodEnd,
      grossCents: input.grossCents,
      feesCents: input.feesCents,
      adjustmentsCents: 0,
      netPayoutCents: input.netCents,
      payoutAt: effectiveSettledAt,
      status: "posted",
      metadata: {
        payoutId: input.payoutId ?? null,
        currency: input.currency,
        syncedAt: new Date().toISOString()
      }
    },
    create: {
      locationId,
      channel: input.channel,
      externalBatchId: input.settlementId,
      periodStart,
      periodEnd,
      grossCents: input.grossCents,
      feesCents: input.feesCents,
      adjustmentsCents: 0,
      netPayoutCents: input.netCents,
      payoutAt: effectiveSettledAt,
      status: "posted",
      metadata: {
        payoutId: input.payoutId ?? null,
        currency: input.currency,
        syncedAt: new Date().toISOString()
      }
    },
    select: {
      id: true
    }
  });

  const existingLine = await prisma.deliverySettlementLine.findFirst({
    where: {
      settlementBatchId: settlementBatch.id,
      externalOrderId: input.externalOrderId
    },
    select: {
      id: true
    }
  });

  const lineData = {
    orderId: matchingOrder?.id,
    externalOrderId: input.externalOrderId,
    grossCents: input.grossCents,
    feesCents: input.feesCents,
    adjustmentsCents: 0,
    netCents: input.netCents,
    metadata: {
      settlementId: input.settlementId,
      payoutId: input.payoutId ?? null,
      currency: input.currency,
      settledAt: effectiveSettledAt.toISOString(),
      syncedAt: new Date().toISOString()
    }
  };

  const settlementLine = existingLine
    ? await prisma.deliverySettlementLine.update({
        where: { id: existingLine.id },
        data: lineData,
        select: { id: true }
      })
    : await prisma.deliverySettlementLine.create({
        data: {
          settlementBatchId: settlementBatch.id,
          ...lineData
        },
        select: { id: true }
      });

  return {
    settlementBatchId: settlementBatch.id,
    settlementLineId: settlementLine.id,
    orderId: matchingOrder?.id ?? null
  };
}

function buildInboundBatch(channel: DeliveryChannel) {
  sequence += 1;
  const currentStamp = new Date().toISOString();
  const primaryOrderId = `${channel}-order-${sequence}`;
  const duplicateToggle = sequence % 2 === 0;
  const duplicateOrderId = duplicateToggle ? `${channel}-order-${sequence - 1}` : primaryOrderId;

  const batch: InboundOrderEnvelope[] = [
    {
      channel,
      externalOrderId: primaryOrderId,
      idempotencyKey: `${channel}:${primaryOrderId}`,
      totalCents: 2400 + sequence * 25,
      placedAt: currentStamp,
      items: [
        { name: "Brisket Plate", quantity: 1 },
        { name: "Smoked Beans", quantity: 1 }
      ]
    },
    {
      channel,
      externalOrderId: duplicateOrderId,
      idempotencyKey: `${channel}:${duplicateOrderId}`,
      totalCents: 1800 + sequence * 15,
      placedAt: currentStamp,
      items: [{ name: "Pulled Pork Sandwich", quantity: 2 }]
    }
  ];

  const queued = fallbackQueue.get(channel);
  if (queued && queued.length > 0) {
    batch.push(...queued.splice(0, 2));
  }

  return batch;
}

async function runSyncCycle() {
  for (const channel of deliveryChannels) {
    console.log(`[workers] syncing channel: ${channel}`);

    const inboundBatch = buildInboundBatch(channel);
    let processedCount = 0;
    let failedCount = 0;
    let deadLetterCount = 0;
    let latencyTotal = 0;

    for (const envelope of inboundBatch) {
      const adapter = adapters[channel];
      const ingestResult = await adapter.ingestOrder(envelope);
      latencyTotal += ingestResult.latencyMs;

      if (ingestResult.status === "processed" || ingestResult.status === "duplicate") {
        processedCount += 1;
        await persistIngestEvent({
          channel,
          eventType: "delivery.order.ingest",
          status: ingestResult.status,
          payload: {
            externalOrderId: envelope.externalOrderId,
            idempotencyKey: envelope.idempotencyKey,
            attempts: ingestResult.attempts,
            latencyMs: ingestResult.latencyMs
          }
        });
        continue;
      }

      failedCount += 1;
      deadLetterCount += 1;
      const channelFallbackQueue = fallbackQueue.get(channel);
      if (channelFallbackQueue) {
        channelFallbackQueue.push(envelope);
      }

      await persistDeadLetter({
        channel,
        reason: ingestResult.reason ?? "Unknown ingest failure",
        orderExternalId: envelope.externalOrderId
      });
    }

    const providerHealth = await adapters[channel].checkHealth();
    const latencyMs =
      Math.round(latencyTotal / Math.max(inboundBatch.length, 1)) +
      Math.round(providerHealth.latencyMs / 2);
    const failureRate = inboundBatch.length > 0 ? failedCount / inboundBatch.length : 0;
    const status =
      !providerHealth.healthy || failureRate >= 0.5
        ? "down"
        : failureRate > 0
          ? "degraded"
          : "healthy";

    await persistHealthEvent({
      channel,
      status,
      processedCount,
      failedCount,
      deadLetterCount,
      latencyMs
    });

    await persistIngestEvent({
      channel,
      eventType: "delivery.sync.provider-health",
      status,
      payload: {
        healthy: providerHealth.healthy,
        providerLatencyMs: providerHealth.latencyMs,
        reason: providerHealth.reason ?? null,
        checkedAt: new Date().toISOString()
      }
    });
  }
}

async function runOutboundStatusSyncCycle() {
  if (!hasDatabaseUrl) {
    return;
  }

  const changedOrders = await prisma.order.findMany({
    where: {
      source: {
        in: ["doordash", "ubereats", "grubhub"]
      },
      updatedAt: {
        gt: lastOutboundSyncAt
      }
    },
    select: {
      id: true,
      status: true,
      source: true,
      updatedAt: true
    },
    orderBy: {
      updatedAt: "asc"
    },
    take: 200
  });

  if (changedOrders.length === 0) {
    return;
  }

  for (const order of changedOrders) {
    const channel = order.source as DeliveryChannel;
    if (!deliveryChannels.includes(channel)) {
      continue;
    }

    const mappedStatus = mapInternalToProviderStatus(order.status);
    if (!mappedStatus) {
      continue;
    }

    const externalOrderId = `${channel}:${order.id}`;
    const adapter = adapters[channel];
    try {
      const syncResult = await adapter.syncOrderStatus({
        externalOrderId,
        status: mappedStatus,
        occurredAt: order.updatedAt.toISOString()
      });

      await persistStatusSyncEvent({
        channel,
        status: "processed",
        payload: {
          orderId: order.id,
          externalOrderId,
          mappedStatus,
          latencyMs: syncResult.latencyMs,
          syncedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      await persistStatusSyncEvent({
        channel,
        status: "failed",
        payload: {
          orderId: order.id,
          externalOrderId,
          mappedStatus,
          error: error instanceof Error ? error.message : "Unknown sync failure",
          syncedAt: new Date().toISOString()
        }
      });
    }
  }

  const newestUpdatedAt = changedOrders[changedOrders.length - 1]?.updatedAt;
  if (newestUpdatedAt) {
    lastOutboundSyncAt = newestUpdatedAt;
  }
}

async function runMenuPublishSyncCycle() {
  if (!hasDatabaseUrl) {
    return;
  }

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    select: {
      id: true,
      menuItems: {
        where: { isAvailable: true },
        select: {
          id: true,
          name: true,
          basePriceCents: true,
          isAvailable: true
        }
      }
    }
  });

  for (const location of locations) {
    for (const channel of deliveryChannels) {
      try {
        const publishResult = await adapters[channel].publishMenuSnapshot({
          locationId: location.id,
          items: location.menuItems.map((item) => ({
            externalItemId: item.id,
            name: item.name,
            priceCents: item.basePriceCents,
            available: item.isAvailable
          })),
          publishedAt: new Date().toISOString()
        });

        await persistIngestEvent({
          channel,
          eventType: "delivery.menu.publish",
          status: "processed",
          payload: {
            locationId: location.id,
            itemCount: location.menuItems.length,
            latencyMs: publishResult.latencyMs,
            publishedAt: new Date().toISOString()
          }
        });
      } catch (error) {
        await persistIngestEvent({
          channel,
          eventType: "delivery.menu.publish",
          status: "failed",
          payload: {
            locationId: location.id,
            itemCount: location.menuItems.length,
            reason: error instanceof Error ? error.message : "Unknown menu publish error",
            publishedAt: new Date().toISOString()
          }
        });
      }
    }
  }
}

async function runDispatchQueueCycle() {
  if (!hasDatabaseUrl) {
    return;
  }

  const queuedDispatches = await prisma.integrationEvent.findMany({
    where: {
      eventType: "delivery.dispatch.requested",
      status: {
        in: ["queued", "pending"]
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 100
  });

  for (const dispatchEvent of queuedDispatches) {
    const channel = dispatchEvent.channel as DeliveryChannel;
    if (!deliveryChannels.includes(channel)) {
      await prisma.integrationEvent.update({
        where: { id: dispatchEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...(dispatchEvent.payload as Prisma.JsonObject),
            reason: "unsupported_channel",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    const payload = dispatchEvent.payload as Prisma.JsonObject;
    const correlationId = getEventCorrelationId(dispatchEvent, `dispatch-${dispatchEvent.id}`);
    const orderId = typeof payload.orderId === "string" ? payload.orderId : undefined;
    const attempts = typeof payload.attempts === "number" ? payload.attempts : 0;
    const maxAttempts = 5;

    if (!orderId) {
      await prisma.integrationEvent.update({
        where: { id: dispatchEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: "missing_order_id",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        source: true,
        externalOrderId: true
      }
    });

    if (!order) {
      await prisma.integrationEvent.update({
        where: { id: dispatchEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            attempts: attempts + 1,
            reason: "order_not_found",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    const externalOrderId =
      typeof payload.orderExternalId === "string"
        ? payload.orderExternalId
        : order.externalOrderId ?? `${channel}:${order.id}`;

    try {
      const result = await adapters[channel].dispatchOrder({
        externalOrderId,
        correlationId,
        priority:
          typeof payload.priority === "string" && payload.priority === "high"
            ? "high"
            : "normal",
        orderTotalCents:
          typeof payload.amountCents === "number" ? payload.amountCents : undefined,
        occurredAt: new Date().toISOString()
      });

      await prisma.integrationEvent.update({
        where: { id: dispatchEvent.id },
        data: {
          correlationId,
          status: "processed",
          payload: {
            ...payload,
            correlationId,
            attempts: attempts + 1,
            orderExternalId: externalOrderId,
            acceptedAt: new Date().toISOString(),
            latencyMs: result.latencyMs
          }
        }
      });

      await persistStatusSyncEvent({
        channel,
        status: "processed",
        payload: {
          orderId: order.id,
          externalOrderId,
          mappedStatus: "accepted",
          correlationId,
          latencyMs: result.latencyMs,
          sourceEventId: dispatchEvent.id,
          syncedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      const nextAttempts = attempts + 1;
      const shouldDeadLetter = nextAttempts >= maxAttempts;

      await prisma.integrationEvent.update({
        where: { id: dispatchEvent.id },
        data: {
          correlationId,
          status: shouldDeadLetter ? "dead_letter" : "queued",
          payload: {
            ...payload,
            correlationId,
            attempts: nextAttempts,
            orderExternalId: externalOrderId,
            lastError: error instanceof Error ? error.message : "dispatch_sync_failed",
            failedAt: new Date().toISOString()
          }
        }
      });
    }
  }
}

async function runOrderActionQueueCycle() {
  if (!hasDatabaseUrl) {
    return;
  }

  const queuedActions = await prisma.integrationEvent.findMany({
    where: {
      eventType: "delivery.order.action.requested",
      status: {
        in: ["queued", "pending"]
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 100
  });

  for (const actionEvent of queuedActions) {
    const channel = actionEvent.channel as DeliveryChannel;
    if (!deliveryChannels.includes(channel)) {
      await prisma.integrationEvent.update({
        where: { id: actionEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...(actionEvent.payload as Prisma.JsonObject),
            reason: "unsupported_channel",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    const payload = actionEvent.payload as Prisma.JsonObject;
    const correlationId = getEventCorrelationId(actionEvent, `action-${actionEvent.id}`);
    const mappedStatus =
      typeof payload.mappedStatus === "string"
        ? (payload.mappedStatus as ProviderStatusSyncInput["status"])
        : undefined;
    const action =
      typeof payload.action === "string" &&
      ["accept", "reject", "cancel", "preparing", "ready", "out_for_delivery", "delivered"].includes(payload.action)
        ? (payload.action as
            | "accept"
            | "reject"
            | "cancel"
            | "preparing"
            | "ready"
            | "out_for_delivery"
            | "delivered")
        : undefined;
    const orderExternalId =
      typeof payload.orderExternalId === "string"
        ? payload.orderExternalId
        : undefined;
    const attempts = typeof payload.attempts === "number" ? payload.attempts : 0;
    const maxAttempts = 5;

    if (!mappedStatus || !orderExternalId || !action) {
      await prisma.integrationEvent.update({
        where: { id: actionEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...payload,
            correlationId,
            reason: "invalid_action_payload",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    try {
      const result = await adapters[channel].sendOrderAction({
        externalOrderId: orderExternalId,
        action,
        reason: typeof payload.reason === "string" ? payload.reason : undefined,
        correlationId,
        occurredAt: new Date().toISOString()
      });

      await prisma.integrationEvent.update({
        where: { id: actionEvent.id },
        data: {
          correlationId,
          status: "processed",
          payload: {
            ...payload,
            correlationId,
            attempts: attempts + 1,
            completedAt: new Date().toISOString(),
            latencyMs: result.latencyMs
          }
        }
      });

      await persistStatusSyncEvent({
        channel,
        status: "processed",
        payload: {
          sourceEventId: actionEvent.id,
          orderExternalId,
          mappedStatus,
          correlationId,
          latencyMs: result.latencyMs,
          syncedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      const nextAttempts = attempts + 1;
      const deadLetter = nextAttempts >= maxAttempts;

      await prisma.integrationEvent.update({
        where: { id: actionEvent.id },
        data: {
          correlationId,
          status: deadLetter ? "dead_letter" : "queued",
          payload: {
            ...payload,
            correlationId,
            attempts: nextAttempts,
            lastError: error instanceof Error ? error.message : "delivery_action_sync_failed",
            failedAt: new Date().toISOString()
          }
        }
      });
    }
  }
}

function extractSettlementPayload(payload: Prisma.JsonObject) {
  const direct = payload.settlement;
  const nestedPayload = payload.payload;
  const nestedRecord =
    nestedPayload && typeof nestedPayload === "object" && !Array.isArray(nestedPayload)
      ? (nestedPayload as Prisma.JsonObject)
      : undefined;

  const nested = nestedRecord?.settlement ?? nestedRecord;
  const candidate =
    direct && typeof direct === "object" && !Array.isArray(direct)
      ? (direct as Prisma.JsonObject)
      : nested && typeof nested === "object" && !Array.isArray(nested)
        ? (nested as Prisma.JsonObject)
        : undefined;

  if (!candidate) {
    return null;
  }

  const settlementId = typeof candidate.settlementId === "string" ? candidate.settlementId : undefined;
  const grossCents = typeof candidate.grossCents === "number" ? candidate.grossCents : undefined;
  const feesCents = typeof candidate.feesCents === "number" ? candidate.feesCents : 0;
  const netCents = typeof candidate.netCents === "number" ? candidate.netCents : undefined;
  const currency = typeof candidate.currency === "string" ? candidate.currency : "usd";
  const payoutId = typeof candidate.payoutId === "string" ? candidate.payoutId : undefined;
  const externalOrderId =
    typeof candidate.externalOrderId === "string"
      ? candidate.externalOrderId
      : typeof payload.orderExternalId === "string"
        ? payload.orderExternalId
        : undefined;
  const settledAt =
    typeof candidate.settledAt === "string"
      ? candidate.settledAt
      : typeof payload.receivedAt === "string"
        ? payload.receivedAt
        : new Date().toISOString();

  if (!settlementId || typeof grossCents !== "number" || typeof netCents !== "number") {
    return null;
  }

  return {
    settlementId,
    payoutId,
    externalOrderId,
    grossCents,
    feesCents,
    netCents,
    currency,
    settledAt
  };
}

async function runSettlementQueueCycle() {
  if (!hasDatabaseUrl) {
    return;
  }

  const queuedSettlementEvents = await prisma.integrationEvent.findMany({
    where: {
      eventType: {
        contains: "settlement"
      },
      status: {
        in: ["queued", "pending"]
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 100
  });

  for (const settlementEvent of queuedSettlementEvents) {
    const channel = settlementEvent.channel as DeliveryChannel;
    if (!deliveryChannels.includes(channel)) {
      await prisma.integrationEvent.update({
        where: { id: settlementEvent.id },
        data: {
          status: "dead_letter",
          payload: {
            ...(settlementEvent.payload as Prisma.JsonObject),
            reason: "unsupported_channel",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    const payload = settlementEvent.payload as Prisma.JsonObject;
    const correlationId = getEventCorrelationId(settlementEvent, `settlement-${settlementEvent.id}`);
    const attempts = typeof payload.attempts === "number" ? payload.attempts : 0;
    const maxAttempts = 5;
    const normalized = extractSettlementPayload(payload);

    if (!normalized) {
      const nextAttempts = attempts + 1;
      await prisma.integrationEvent.update({
        where: { id: settlementEvent.id },
        data: {
          status: nextAttempts >= maxAttempts ? "dead_letter" : "queued",
          payload: {
            ...payload,
            correlationId,
            attempts: nextAttempts,
            reason: "invalid_settlement_payload",
            failedAt: new Date().toISOString()
          }
        }
      });
      continue;
    }

    if (!normalized.externalOrderId) {
      const nextAttempts = attempts + 1;
      const deadLetter = nextAttempts >= maxAttempts;

      await prisma.integrationEvent.update({
        where: { id: settlementEvent.id },
        data: {
          status: deadLetter ? "dead_letter" : "queued",
          payload: {
            ...payload,
            correlationId,
            attempts: nextAttempts,
            reason: "missing_settlement_order_external_id",
            failedAt: new Date().toISOString(),
            settlement: {
              settlementId: normalized.settlementId,
              payoutId: normalized.payoutId ?? null,
              externalOrderId: null,
              grossCents: normalized.grossCents,
              feesCents: normalized.feesCents,
              netCents: normalized.netCents,
              currency: normalized.currency,
              settledAt: normalized.settledAt
            }
          }
        }
      });
      continue;
    }

    const duplicateSettlement = await prisma.integrationEvent.findFirst({
      where: {
        id: { not: settlementEvent.id },
        channel,
        eventType: {
          contains: "settlement"
        },
        status: "processed",
        OR: [
          {
            payload: {
              path: ["settlement", "settlementId"],
              equals: normalized.settlementId
            }
          },
          {
            payload: {
              path: ["settlementId"],
              equals: normalized.settlementId
            }
          }
        ]
      },
      select: { id: true }
    });

    if (duplicateSettlement) {
      await prisma.integrationEvent.update({
        where: { id: settlementEvent.id },
        data: {
          status: "ignored",
          payload: {
            ...payload,
            correlationId,
            attempts: attempts + 1,
            reason: "duplicate_settlement_ignored",
            duplicateOfEventId: duplicateSettlement.id,
            processedAt: new Date().toISOString(),
            settlement: {
              settlementId: normalized.settlementId,
              payoutId: normalized.payoutId ?? null,
              externalOrderId: normalized.externalOrderId ?? null,
              grossCents: normalized.grossCents,
              feesCents: normalized.feesCents,
              netCents: normalized.netCents,
              currency: normalized.currency,
              settledAt: normalized.settledAt
            }
          }
        }
      });
      continue;
    }

    try {
      const syncResult = await adapters[channel].syncSettlement({
        externalOrderId: normalized.externalOrderId,
        settlementId: normalized.settlementId,
        grossCents: normalized.grossCents,
        feesCents: normalized.feesCents,
        netCents: normalized.netCents,
        currency: normalized.currency,
        settledAt: normalized.settledAt
      });

      const ledgerRecord = await persistSettlementLedgerRecord({
        channel,
        settlementId: normalized.settlementId,
        payoutId: normalized.payoutId,
        externalOrderId: normalized.externalOrderId,
        grossCents: normalized.grossCents,
        feesCents: normalized.feesCents,
        netCents: normalized.netCents,
        currency: normalized.currency,
        settledAt: normalized.settledAt
      });

      await prisma.integrationEvent.update({
        where: { id: settlementEvent.id },
        data: {
          correlationId,
          orderId: ledgerRecord?.orderId ?? undefined,
          status: "processed",
          payload: {
            ...payload,
            correlationId,
            attempts: attempts + 1,
            processedAt: new Date().toISOString(),
            latencyMs: syncResult.latencyMs,
            settlementBatchId: ledgerRecord?.settlementBatchId ?? null,
            settlementLineId: ledgerRecord?.settlementLineId ?? null,
            settlement: {
              settlementId: normalized.settlementId,
              payoutId: normalized.payoutId ?? null,
              externalOrderId: normalized.externalOrderId,
              grossCents: normalized.grossCents,
              feesCents: normalized.feesCents,
              netCents: normalized.netCents,
              currency: normalized.currency,
              settledAt: normalized.settledAt
            }
          }
        }
      });

      await persistSettlementSyncEvent({
        channel,
        status: "processed",
        payload: {
          sourceEventId: settlementEvent.id,
          correlationId,
          orderId: ledgerRecord?.orderId ?? null,
          settlementBatchId: ledgerRecord?.settlementBatchId ?? null,
          settlementLineId: ledgerRecord?.settlementLineId ?? null,
          settlementId: normalized.settlementId,
          payoutId: normalized.payoutId ?? null,
          orderExternalId: normalized.externalOrderId,
          grossCents: normalized.grossCents,
          feesCents: normalized.feesCents,
          netCents: normalized.netCents,
          currency: normalized.currency,
          settledAt: normalized.settledAt,
          latencyMs: syncResult.latencyMs,
          syncedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      const nextAttempts = attempts + 1;
      const deadLetter = nextAttempts >= maxAttempts;

      await prisma.integrationEvent.update({
        where: { id: settlementEvent.id },
        data: {
          correlationId,
          status: deadLetter ? "dead_letter" : "queued",
          payload: {
            ...payload,
            correlationId,
            attempts: nextAttempts,
            lastError: error instanceof Error ? error.message : "settlement_sync_failed",
            failedAt: new Date().toISOString(),
            settlement: {
              settlementId: normalized.settlementId,
              payoutId: normalized.payoutId ?? null,
              externalOrderId: normalized.externalOrderId,
              grossCents: normalized.grossCents,
              feesCents: normalized.feesCents,
              netCents: normalized.netCents,
              currency: normalized.currency,
              settledAt: normalized.settledAt
            }
          }
        }
      });

      await persistSettlementSyncEvent({
        channel,
        status: deadLetter ? "dead_letter" : "queued",
        payload: {
          sourceEventId: settlementEvent.id,
          correlationId,
          settlementId: normalized.settlementId,
          payoutId: normalized.payoutId ?? null,
          orderExternalId: normalized.externalOrderId,
          grossCents: normalized.grossCents,
          feesCents: normalized.feesCents,
          netCents: normalized.netCents,
          currency: normalized.currency,
          settledAt: normalized.settledAt,
          attempts: nextAttempts,
          error: error instanceof Error ? error.message : "settlement_sync_failed",
          syncedAt: new Date().toISOString()
        }
      });
    }
  }
}

setInterval(() => {
  runSyncCycle().catch((error) => {
    console.error("[workers] sync cycle failed", error);
  });
}, 30000);

setInterval(() => {
  runOutboundStatusSyncCycle().catch((error) => {
    console.error("[workers] outbound status sync cycle failed", error);
  });
}, 15000);

setInterval(() => {
  runMenuPublishSyncCycle().catch((error) => {
    console.error("[workers] menu publish sync cycle failed", error);
  });
}, 60000);

setInterval(() => {
  runDispatchQueueCycle().catch((error) => {
    console.error("[workers] dispatch queue cycle failed", error);
  });
}, 10000);

setInterval(() => {
  runOrderActionQueueCycle().catch((error) => {
    console.error("[workers] order action queue cycle failed", error);
  });
}, 10000);

setInterval(() => {
  runWebhookOrderQueueCycle().catch((error) => {
    console.error("[workers] webhook order queue cycle failed", error);
  });
}, 8000);

setInterval(() => {
  runWebhookStatusQueueCycle().catch((error) => {
    console.error("[workers] webhook status queue cycle failed", error);
  });
}, 8000);

setInterval(() => {
  runSettlementQueueCycle().catch((error) => {
    console.error("[workers] settlement queue cycle failed", error);
  });
}, 10000);

console.log("[workers] started integration worker service");
