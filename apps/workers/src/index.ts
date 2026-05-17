import { prisma, Prisma } from "@bbq/database";
import {
  createDeliveryChannelAdapters,
  deliveryChannels,
  type DeliveryChannel,
  type InboundOrderEnvelope,
  type DeliveryProviderCredentials,
  type ProviderStatusSyncInput
} from "@bbq/delivery-channels";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
function readChannelCredentials(channel: DeliveryChannel): DeliveryProviderCredentials {
  const upper = channel.toUpperCase();

  return {
    apiKey: process.env[`${upper}_API_KEY`] ?? "",
    apiSecret: process.env[`${upper}_API_SECRET`],
    webhookSecret: process.env[`${upper}_WEBHOOK_SECRET`],
    merchantId: process.env[`${upper}_MERCHANT_ID`],
    storeId: process.env[`${upper}_STORE_ID`]
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

  await prisma.integrationEvent.create({
    data: {
      channel: input.channel,
      eventType: "delivery.sync.health",
      status: input.status,
      payload: {
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

  await prisma.integrationEvent.create({
    data: {
      channel: input.channel,
      eventType: "delivery.order.sync",
      status: "dead_letter",
      payload: {
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

  await prisma.integrationEvent.create({
    data: {
      channel: input.channel,
      eventType: input.eventType,
      status: input.status,
      payload: input.payload as Prisma.InputJsonValue
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

  await prisma.integrationEvent.create({
    data: {
      channel: input.channel,
      eventType: "delivery.order.status.sync",
      status: input.status,
      payload: input.payload as Prisma.InputJsonValue
    }
  });
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
    const correlationId = getPayloadCorrelationId(payload, `dispatch-${dispatchEvent.id}`);
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
      const result = await adapters[channel].syncOrderStatus({
        externalOrderId,
        status: "accepted",
        occurredAt: new Date().toISOString()
      });

      await prisma.integrationEvent.update({
        where: { id: dispatchEvent.id },
        data: {
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
    const correlationId = getPayloadCorrelationId(payload, `action-${actionEvent.id}`);
    const mappedStatus =
      typeof payload.mappedStatus === "string"
        ? (payload.mappedStatus as ProviderStatusSyncInput["status"])
        : undefined;
    const orderExternalId =
      typeof payload.orderExternalId === "string"
        ? payload.orderExternalId
        : undefined;
    const attempts = typeof payload.attempts === "number" ? payload.attempts : 0;
    const maxAttempts = 5;

    if (!mappedStatus || !orderExternalId) {
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
      const result = await adapters[channel].syncOrderStatus({
        externalOrderId: orderExternalId,
        status: mappedStatus,
        reason: typeof payload.reason === "string" ? payload.reason : undefined,
        occurredAt: new Date().toISOString()
      });

      await prisma.integrationEvent.update({
        where: { id: actionEvent.id },
        data: {
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
    const correlationId = getPayloadCorrelationId(payload, `settlement-${settlementEvent.id}`);
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

    await prisma.integrationEvent.update({
      where: { id: settlementEvent.id },
      data: {
        status: "processed",
        payload: {
          ...payload,
          correlationId,
          attempts: attempts + 1,
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
  runSettlementQueueCycle().catch((error) => {
    console.error("[workers] settlement queue cycle failed", error);
  });
}, 10000);

console.log("[workers] started integration worker service");
