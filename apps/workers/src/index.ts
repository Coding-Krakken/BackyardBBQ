import { prisma } from "@bbq/database";
import {
  createDeliveryChannelAdapters,
  deliveryChannels,
  type DeliveryChannel,
  type InboundOrderEnvelope
} from "@bbq/delivery-channels";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const adapters = createDeliveryChannelAdapters({
  retryPolicy: {
    maxAttempts: 3,
    backoffBaseMs: 140,
    backoffMultiplier: 2
  }
});
const fallbackQueue = new Map<DeliveryChannel, InboundOrderEnvelope[]>();

deliveryChannels.forEach((channel) => {
  fallbackQueue.set(channel, []);
});

let sequence = 0;

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
      payload: input.payload
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

    const latencyMs = Math.round(latencyTotal / Math.max(inboundBatch.length, 1));
    const failureRate = inboundBatch.length > 0 ? failedCount / inboundBatch.length : 0;
    const status = failureRate >= 0.5 ? "down" : failureRate > 0 ? "degraded" : "healthy";

    await persistHealthEvent({
      channel,
      status,
      processedCount,
      failedCount,
      deadLetterCount,
      latencyMs
    });
  }
}

setInterval(() => {
  runSyncCycle().catch((error) => {
    console.error("[workers] sync cycle failed", error);
  });
}, 30000);

console.log("[workers] started integration worker service");
