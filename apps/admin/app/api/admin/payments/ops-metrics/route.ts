import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [payments, stripeEvents] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: { createdAt: { gte: since } },
      select: {
        amountCents: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.integrationEvent.findMany({
      where: {
        channel: "stripe",
        createdAt: { gte: since },
      },
      select: {
        eventType: true,
        payload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalTransactions = payments.length;
  const successfulTransactions = payments.filter((p) => p.status === "succeeded").length;
  const refundedTransactions = payments.filter(
    (p) => p.status === "refunded" || p.status === "partially_refunded"
  ).length;

  const settledVolumeCents = payments
    .filter((p) => ["succeeded", "refunded", "partially_refunded"].includes(p.status))
    .reduce((sum, p) => sum + p.amountCents, 0);
  const refundedVolumeCents = payments
    .filter((p) => p.status === "refunded" || p.status === "partially_refunded")
    .reduce((sum, p) => sum + p.amountCents, 0);

  const disputeEvents = stripeEvents.filter((e) => e.eventType.includes("charge.dispute"));

  const webhookWithLatency = stripeEvents
    .map((e) => {
      const payload = e.payload as Record<string, unknown>;
      const updatedAt =
        typeof payload.updatedAt === "number"
          ? payload.updatedAt
          : null;
      if (!updatedAt) return null;
      const latencyMs = e.createdAt.getTime() - updatedAt * 1000;
      return latencyMs >= 0 ? latencyMs : null;
    })
    .filter((value): value is number => typeof value === "number");

  const averageWebhookLatencyMs =
    webhookWithLatency.length > 0
      ? Math.round(
          webhookWithLatency.reduce((sum, latency) => sum + latency, 0) /
            webhookWithLatency.length
        )
      : 0;

  const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;
  const refundRate = settledVolumeCents > 0 ? (refundedVolumeCents / settledVolumeCents) * 100 : 0;
  const disputeRate = totalTransactions > 0 ? (disputeEvents.length / totalTransactions) * 100 : 0;
  const averagePaymentCents = totalTransactions > 0 ? Math.round(settledVolumeCents / totalTransactions) : 0;

  const dailyRevenueMap: Record<string, number> = {};
  const dailyRefundMap: Record<string, number> = {};
  const dailyDisputeMap: Record<string, number> = {};

  for (const payment of payments) {
    const key = toDateKey(payment.createdAt);
    if (!dailyRevenueMap[key]) dailyRevenueMap[key] = 0;
    if (!dailyRefundMap[key]) dailyRefundMap[key] = 0;

    if (["succeeded", "refunded", "partially_refunded"].includes(payment.status)) {
      dailyRevenueMap[key] += payment.amountCents;
    }
    if (payment.status === "refunded" || payment.status === "partially_refunded") {
      dailyRefundMap[key] += payment.amountCents;
    }
  }

  for (const event of disputeEvents) {
    const key = toDateKey(event.createdAt);
    if (!dailyDisputeMap[key]) dailyDisputeMap[key] = 0;
    dailyDisputeMap[key] += 1;
  }

  const dayKeys = new Set([
    ...Object.keys(dailyRevenueMap),
    ...Object.keys(dailyRefundMap),
    ...Object.keys(dailyDisputeMap),
  ]);

  const daily = Array.from(dayKeys)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      revenueCents: dailyRevenueMap[date] ?? 0,
      refundsCents: dailyRefundMap[date] ?? 0,
      disputeCount: dailyDisputeMap[date] ?? 0,
    }));

  return NextResponse.json({
    windowDays: days,
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
      lastWebhookAt:
        stripeEvents.length > 0
          ? stripeEvents[stripeEvents.length - 1]?.createdAt.toISOString() ?? null
          : null,
    },
    daily,
  });
}
