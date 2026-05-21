import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import {
  PAYMENT_SUCCESS_STATUSES,
  PAYMENT_REFUND_STATUSES,
  PAYMENT_REVENUE_STATUSES,
} from "@bbq/domain";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseUpdatedAtMs(payload: Record<string, unknown>): number | null {
  const candidates = [payload.updatedAt, payload.occurredAt, payload.eventTimestamp];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      // Heuristic: 13+ digits is milliseconds; otherwise treat as epoch seconds.
      return candidate >= 1_000_000_000_000 ? candidate : candidate * 1000;
    }

    if (typeof candidate === "string") {
      const asNumber = Number(candidate);
      if (Number.isFinite(asNumber) && asNumber > 0) {
        return asNumber >= 1_000_000_000_000 ? asNumber : asNumber * 1000;
      }

      const asDate = Date.parse(candidate);
      if (Number.isFinite(asDate)) {
        return asDate;
      }
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [payments, integrationEvents] = await Promise.all([
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
        createdAt: { gte: since },
      },
      select: {
        channel: true,
        eventType: true,
        payload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const webhookEvents = integrationEvents.filter(
    (event) => event.channel === "stripe" || event.channel === "epos"
  );
  const disputeEvents = integrationEvents.filter((event) => event.eventType.includes("dispute"));

  const totalTransactions = payments.length;
  const successfulTransactions = payments.filter(
    (p) => PAYMENT_SUCCESS_STATUSES.includes(p.status as typeof PAYMENT_SUCCESS_STATUSES[number])
  ).length;
  const refundedTransactions = payments.filter(
    (p) => PAYMENT_REFUND_STATUSES.includes(p.status as typeof PAYMENT_REFUND_STATUSES[number])
  ).length;

  const settledVolumeCents = payments
    .filter((p) => PAYMENT_REVENUE_STATUSES.includes(p.status as typeof PAYMENT_REVENUE_STATUSES[number]))
    .reduce((sum, p) => sum + p.amountCents, 0);
  const refundedVolumeCents = payments
    .filter((p) => PAYMENT_REFUND_STATUSES.includes(p.status as typeof PAYMENT_REFUND_STATUSES[number]))
    .reduce((sum, p) => sum + p.amountCents, 0);

  const webhookWithLatency = webhookEvents
    .map((e) => {
      const payload = e.payload as Record<string, unknown>;
      const updatedAtMs = parseUpdatedAtMs(payload);
      if (!updatedAtMs) return null;
      const latencyMs = e.createdAt.getTime() - updatedAtMs;
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

    if (PAYMENT_REVENUE_STATUSES.includes(payment.status as typeof PAYMENT_REVENUE_STATUSES[number])) {
      dailyRevenueMap[key] += payment.amountCents;
    }
    if (PAYMENT_REFUND_STATUSES.includes(payment.status as typeof PAYMENT_REFUND_STATUSES[number])) {
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
      webhookEvents: webhookEvents.length,
      averageWebhookLatencyMs,
      lastWebhookAt:
        webhookEvents.length > 0
          ? webhookEvents[webhookEvents.length - 1]?.createdAt.toISOString() ?? null
          : null,
    },
    daily,
  });
}
