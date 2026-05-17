import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const now = Date.now();
  const since = new Date(now - 24 * 60 * 60 * 1000);
  const baselineSince = new Date(now - 8 * 24 * 60 * 60 * 1000);

  const [failedEvents, settlementBacklog, settlementProcessed, settlementProcessedTrend] = await Promise.all([
    prisma.integrationEvent.findMany({
      where: { createdAt: { gte: since }, status: { in: ["failed", "dead_letter"] } },
      select: { channel: true, status: true, eventType: true, payload: true }
    }),
    prisma.integrationEvent.groupBy({
      by: ["channel"],
      where: {
        createdAt: { gte: since },
        eventType: { contains: "settlement" },
        status: { in: ["queued", "pending"] }
      },
      _count: { _all: true }
    }),
    prisma.integrationEvent.findMany({
      where: {
        createdAt: { gte: since },
        eventType: { contains: "settlement" },
        status: "processed"
      },
      select: {
        channel: true,
        payload: true
      }
    }),
    prisma.integrationEvent.findMany({
      where: {
        createdAt: { gte: baselineSince },
        eventType: { contains: "settlement" },
        status: "processed"
      },
      select: {
        channel: true,
        createdAt: true,
        payload: true
      }
    })
  ]);

  const alerts: Array<{ severity: "critical" | "warning" | "info"; channel: string; message: string }> = [];
  const channelFailures: Record<string, number> = {};
  const actionDeadLettersByChannel: Record<string, number> = {};
  const settlementDeadLettersByChannel: Record<string, number> = {};
  const settlementTotalsByChannel: Record<string, { grossCents: number; feesCents: number }> = {};
  const settlementTrendByChannel: Record<
    string,
    {
      recentGrossCents: number;
      recentFeesCents: number;
      baselineGrossCents: number;
      baselineFeesCents: number;
    }
  > = {};

  for (const e of failedEvents) {
    channelFailures[e.channel] = (channelFailures[e.channel] ?? 0) + 1;
    if (e.eventType === "delivery.order.action.requested" && (e.status === "dead_letter" || e.status === "failed")) {
      actionDeadLettersByChannel[e.channel] = (actionDeadLettersByChannel[e.channel] ?? 0) + 1;
    }

    if (e.eventType.includes("settlement") && (e.status === "dead_letter" || e.status === "failed")) {
      settlementDeadLettersByChannel[e.channel] = (settlementDeadLettersByChannel[e.channel] ?? 0) + 1;
    }
  }

  for (const settlementEvent of settlementProcessed) {
    const payload = settlementEvent.payload as Record<string, unknown>;
    const settlementPayload =
      payload.settlement && typeof payload.settlement === "object"
        ? (payload.settlement as Record<string, unknown>)
        : payload;

    const grossCents = typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    const feesCents = typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;

    if (!settlementTotalsByChannel[settlementEvent.channel]) {
      settlementTotalsByChannel[settlementEvent.channel] = { grossCents: 0, feesCents: 0 };
    }

    const totals = settlementTotalsByChannel[settlementEvent.channel]!;
    totals.grossCents += grossCents;
    totals.feesCents += feesCents;
  }

  for (const settlementEvent of settlementProcessedTrend) {
    const payload = settlementEvent.payload as Record<string, unknown>;
    const settlementPayload =
      payload.settlement && typeof payload.settlement === "object"
        ? (payload.settlement as Record<string, unknown>)
        : payload;

    const grossCents = typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    const feesCents = typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;

    if (!settlementTrendByChannel[settlementEvent.channel]) {
      settlementTrendByChannel[settlementEvent.channel] = {
        recentGrossCents: 0,
        recentFeesCents: 0,
        baselineGrossCents: 0,
        baselineFeesCents: 0
      };
    }

    const trend = settlementTrendByChannel[settlementEvent.channel]!;
    if (settlementEvent.createdAt >= since) {
      trend.recentGrossCents += grossCents;
      trend.recentFeesCents += feesCents;
    } else {
      trend.baselineGrossCents += grossCents;
      trend.baselineFeesCents += feesCents;
    }
  }

  for (const [channel, count] of Object.entries(channelFailures)) {
    const severity: "critical" | "warning" | "info" = count > 10 ? "critical" : count > 3 ? "warning" : "info";
    alerts.push({ severity, channel, message: `${count} failed event(s) in the last 24 h` });
  }

  for (const [channel, count] of Object.entries(actionDeadLettersByChannel)) {
    const severity: "critical" | "warning" | "info" = count > 5 ? "critical" : count > 1 ? "warning" : "info";
    alerts.push({
      severity,
      channel,
      message: `${count} delivery action event(s) reached dead-letter in the last 24 h`
    });
  }

  for (const [channel, count] of Object.entries(settlementDeadLettersByChannel)) {
    const severity: "critical" | "warning" | "info" = count > 3 ? "critical" : count > 0 ? "warning" : "info";
    alerts.push({
      severity,
      channel,
      message: `${count} delivery settlement event(s) failed or reached dead-letter in the last 24 h`
    });
  }

  for (const row of settlementBacklog) {
    const count = row._count._all;
    const severity: "critical" | "warning" | "info" = count > 15 ? "critical" : count > 5 ? "warning" : "info";
    alerts.push({
      severity,
      channel: row.channel,
      message: `${count} delivery settlement event(s) are still queued/pending`
    });
  }

  for (const [channel, totals] of Object.entries(settlementTotalsByChannel)) {
    if (totals.grossCents <= 0) {
      continue;
    }

    const feeRatio = totals.feesCents / totals.grossCents;
    if (feeRatio < 0.35) {
      continue;
    }

    const severity: "critical" | "warning" | "info" = feeRatio >= 0.45 ? "critical" : "warning";
    alerts.push({
      severity,
      channel,
      message: `Settlement fee ratio is ${(feeRatio * 100).toFixed(1)}% in the last 24 h`
    });
  }

  for (const [channel, trend] of Object.entries(settlementTrendByChannel)) {
    if (trend.recentGrossCents <= 0 || trend.baselineGrossCents <= 0) {
      continue;
    }

    const recentFeeRate = trend.recentFeesCents / trend.recentGrossCents;
    const baselineFeeRate = trend.baselineFeesCents / trend.baselineGrossCents;
    const feeRateDelta = recentFeeRate - baselineFeeRate;

    if (feeRateDelta < 0.08) {
      continue;
    }

    const severity: "critical" | "warning" | "info" = feeRateDelta >= 0.15 ? "critical" : "warning";
    alerts.push({
      severity,
      channel,
      message: `Settlement fee ratio increased ${(feeRateDelta * 100).toFixed(1)} pts vs 7-day baseline (${(recentFeeRate * 100).toFixed(1)}% vs ${(baselineFeeRate * 100).toFixed(1)}%)`
    });
  }

  const summary = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length
  };

  return NextResponse.json({ summary, alerts });
}
