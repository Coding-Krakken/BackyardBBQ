import type { PrismaClient } from "@prisma/client";

type PaymentStatusRow = {
  status: string;
  _count: { _all: number };
  _sum: { amountCents: number | null };
};

const WEBHOOK_CHANNELS = ["stripe", "epos"] as const;

type MetricsPrismaClient = Pick<PrismaClient, "$queryRaw"> & {
  paymentTransaction: Pick<PrismaClient["paymentTransaction"], "groupBy">;
  integrationEvent: Pick<PrismaClient["integrationEvent"], "count" | "findFirst">;
};

export async function buildPaymentMetricsSnapshot(input: {
  days: number;
  hasDatabaseUrl: boolean;
  prisma: MetricsPrismaClient;
}) {
  const { days, hasDatabaseUrl, prisma } = input;

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

  const [paymentStatusBreakdown, disputeCount, webhookEvents, lastWebhook, webhookLatencyRows] = await Promise.all([
    prisma.paymentTransaction.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { amountCents: true }
    }),
    prisma.integrationEvent.count({
      where: {
        eventType: { contains: "dispute" },
        createdAt: { gte: since }
      }
    }),
    prisma.integrationEvent.count({
      where: {
        channel: { in: WEBHOOK_CHANNELS as unknown as string[] },
        createdAt: { gte: since }
      }
    }),
    prisma.integrationEvent.findFirst({
      where: {
        channel: { in: WEBHOOK_CHANNELS as unknown as string[] },
        createdAt: { gte: since }
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    }),
    prisma.$queryRaw<Array<{ average_latency_ms: number | null }>>`
      SELECT AVG(
        GREATEST(
          (
            EXTRACT(EPOCH FROM "createdAt")
            - COALESCE(
              CASE
                WHEN (payload->>'updatedAt') ~ '^[0-9]+(\\.[0-9]+)?$'
                  THEN
                    CASE
                      WHEN (payload->>'updatedAt')::double precision >= 1000000000000
                        THEN (payload->>'updatedAt')::double precision / 1000
                      ELSE (payload->>'updatedAt')::double precision
                    END
              END,
              CASE
                WHEN (payload->>'occurredAt') ~ '^[0-9]+(\\.[0-9]+)?$'
                  THEN
                    CASE
                      WHEN (payload->>'occurredAt')::double precision >= 1000000000000
                        THEN (payload->>'occurredAt')::double precision / 1000
                      ELSE (payload->>'occurredAt')::double precision
                    END
              END,
              CASE
                WHEN (payload->>'eventTimestamp') ~ '^[0-9]+(\\.[0-9]+)?$'
                  THEN
                    CASE
                      WHEN (payload->>'eventTimestamp')::double precision >= 1000000000000
                        THEN (payload->>'eventTimestamp')::double precision / 1000
                      ELSE (payload->>'eventTimestamp')::double precision
                    END
              END
            )
          ) * 1000,
          0
        )
      ) AS average_latency_ms
      FROM "IntegrationEvent"
      WHERE "channel" IN ('stripe', 'epos')
        AND "createdAt" >= ${since}
        AND (
          (payload->>'updatedAt') ~ '^[0-9]+(\\.[0-9]+)?$'
          OR (payload->>'occurredAt') ~ '^[0-9]+(\\.[0-9]+)?$'
          OR (payload->>'eventTimestamp') ~ '^[0-9]+(\\.[0-9]+)?$'
        )
    `
  ]);

  const totalTransactions = paymentStatusBreakdown.reduce((sum, row) => sum + row._count._all, 0);
  const successfulTransactions = paymentStatusBreakdown.reduce(
    (sum, row) => sum + (row.status === "succeeded" ? row._count._all : 0),
    0
  );
  const refundedTransactions = paymentStatusBreakdown.reduce(
    (sum, row) => sum + ((row.status === "refunded" || row.status === "partially_refunded") ? row._count._all : 0),
    0
  );

  const settledVolumeCents = paymentStatusBreakdown.reduce((sum, row) => {
    return ["succeeded", "refunded", "partially_refunded"].includes(row.status)
      ? sum + (row._sum.amountCents ?? 0)
      : sum;
  }, 0);

  const refundedVolumeCents = paymentStatusBreakdown.reduce((sum, row) => {
    return row.status === "refunded" || row.status === "partially_refunded"
      ? sum + (row._sum.amountCents ?? 0)
      : sum;
  }, 0);

  const averageWebhookLatencyMs = Math.max(0, Math.round(webhookLatencyRows[0]?.average_latency_ms ?? 0));
  const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;
  const refundRate = settledVolumeCents > 0 ? (refundedVolumeCents / settledVolumeCents) * 100 : 0;
  const disputeRate = totalTransactions > 0 ? (disputeCount / totalTransactions) * 100 : 0;
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
      disputeCount,
      successRate,
      refundRate,
      disputeRate,
      averagePaymentCents,
      webhookEvents,
      averageWebhookLatencyMs,
      lastWebhookAt: lastWebhook?.createdAt.toISOString() ?? null
    }
  };
}
