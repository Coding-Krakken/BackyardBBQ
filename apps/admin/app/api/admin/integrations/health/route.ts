import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  // Compute health metrics per channel from IntegrationEvent records in the last 24 h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const events = await prisma.integrationEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { channel: true, status: true, createdAt: true, eventType: true, payload: true }
  });

  const channelMap: Record<
    string,
    {
      processed: number;
      failed: number;
      deadLetter: number;
      queued: number;
      dispatchQueued: number;
      dispatchProcessed: number;
      actionQueued: number;
      actionProcessed: number;
      actionDeadLetter: number;
      settlementQueued: number;
      settlementProcessed: number;
      settlementNetCents: number;
      latencies: number[];
      lastCheck: string;
    }
  > = {};

  for (const e of events) {
    if (!channelMap[e.channel]) {
      channelMap[e.channel] = {
        processed: 0,
        failed: 0,
        deadLetter: 0,
        queued: 0,
        dispatchQueued: 0,
        dispatchProcessed: 0,
        actionQueued: 0,
        actionProcessed: 0,
        actionDeadLetter: 0,
        settlementQueued: 0,
        settlementProcessed: 0,
        settlementNetCents: 0,
        latencies: [],
        lastCheck: e.createdAt.toISOString()
      };
    }

    const c = channelMap[e.channel]!;
    if (e.status === "processed" || e.status === "completed") c.processed += 1;
    else if (e.status === "failed") { c.failed += 1; c.deadLetter += 1; }
    else if (e.status === "dead_letter") c.deadLetter += 1;
    else if (e.status === "queued" || e.status === "pending") c.queued += 1;

    if (e.eventType === "delivery.dispatch.requested") {
      if (e.status === "queued" || e.status === "pending") c.dispatchQueued += 1;
      if (e.status === "processed") c.dispatchProcessed += 1;
    }

    if (e.eventType === "delivery.order.action.requested") {
      if (e.status === "queued" || e.status === "pending") c.actionQueued += 1;
      if (e.status === "processed") c.actionProcessed += 1;
      if (e.status === "dead_letter" || e.status === "failed") c.actionDeadLetter += 1;
    }

    if (e.eventType.includes("settlement")) {
      if (e.status === "queued" || e.status === "pending") c.settlementQueued += 1;
      if (e.status === "processed") c.settlementProcessed += 1;

      const payload = e.payload as Record<string, unknown>;
      const settlementPayload =
        payload.settlement && typeof payload.settlement === "object"
          ? (payload.settlement as Record<string, unknown>)
          : payload;
      if (typeof settlementPayload.netCents === "number") {
        c.settlementNetCents += settlementPayload.netCents;
      }
    }

    const payload = e.payload as Record<string, unknown>;
    const payloadLatency = typeof payload.latencyMs === "number" ? payload.latencyMs : undefined;
    c.latencies.push(payloadLatency ?? Math.max(1, Date.now() - e.createdAt.getTime()));
    c.lastCheck = e.createdAt.toISOString();
  }

  const data = Object.entries(channelMap).map(([channel, v]) => ({
    channel,
    status: v.deadLetter > 0 || v.failed > v.processed ? "degraded" : "healthy",
    processedCount: v.processed,
    failedCount: v.failed,
    deadLetterCount: v.deadLetter,
    queuedCount: v.queued,
    dispatchQueuedCount: v.dispatchQueued,
    dispatchProcessedCount: v.dispatchProcessed,
    actionQueuedCount: v.actionQueued,
    actionProcessedCount: v.actionProcessed,
    actionDeadLetterCount: v.actionDeadLetter,
    settlementQueuedCount: v.settlementQueued,
    settlementProcessedCount: v.settlementProcessed,
    settlementNetCents: v.settlementNetCents,
    latencyMs: v.latencies.length > 0 ? Math.round(v.latencies.reduce((a, b) => a + b, 0) / v.latencies.length) : 0,
    recordedAt: v.lastCheck
  }));

  return NextResponse.json({ data });
}
