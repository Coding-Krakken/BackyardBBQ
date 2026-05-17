import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

type AlertSeverity = "critical" | "warning" | "info";

interface AlertEvidence {
  eventIds?: string[];
  settlementIds?: string[];
  apiPath?: string;
  artifactPath?: string;
  baselineApiPath?: string;
}

interface AlertRow {
  severity: AlertSeverity;
  channel: string;
  message: string;
  evidence?: AlertEvidence;
}

function extractSettlementPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const root = payload as Record<string, unknown>;
  if (root.settlement && typeof root.settlement === "object") {
    return root.settlement as Record<string, unknown>;
  }

  return root;
}

function extractSettlementId(payload: unknown): string | null {
  const settlementPayload = extractSettlementPayload(payload);
  const settlementId = settlementPayload.settlementId;
  return typeof settlementId === "string" && settlementId.length > 0 ? settlementId : null;
}

function pushSample(values: string[], value: string, limit = 3) {
  if (!value || values.includes(value) || values.length >= limit) {
    return;
  }
  values.push(value);
}

function ensureEvidenceBucket<T>(
  collection: Record<string, T>,
  channel: string,
  factory: () => T
): T {
  if (!collection[channel]) {
    collection[channel] = factory();
  }
  return collection[channel]!;
}

export async function GET() {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const now = Date.now();
  const since = new Date(now - 24 * 60 * 60 * 1000);
  const baselineSince = new Date(now - 8 * 24 * 60 * 60 * 1000);

  const [failedEvents, settlementBacklog, settlementBacklogEvents, settlementProcessed, settlementProcessedTrend] = await Promise.all([
    prisma.integrationEvent.findMany({
      where: { createdAt: { gte: since }, status: { in: ["failed", "dead_letter"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, channel: true, status: true, eventType: true, payload: true }
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
        status: { in: ["queued", "pending"] }
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        channel: true,
        payload: true
      }
    }),
    prisma.integrationEvent.findMany({
      where: {
        createdAt: { gte: since },
        eventType: { contains: "settlement" },
        status: "processed"
      },
      select: {
        id: true,
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
        id: true,
        channel: true,
        createdAt: true,
        payload: true
      }
    })
  ]);

  const alerts: AlertRow[] = [];
  const channelFailures: Record<string, number> = {};
  const actionDeadLettersByChannel: Record<string, number> = {};
  const settlementDeadLettersByChannel: Record<string, number> = {};
  const settlementTotalsByChannel: Record<string, { grossCents: number; feesCents: number }> = {};
  const failureEvidenceByChannel: Record<string, { eventIds: string[] }> = {};
  const actionEvidenceByChannel: Record<string, { eventIds: string[] }> = {};
  const settlementFailureEvidenceByChannel: Record<string, { eventIds: string[]; settlementIds: string[] }> = {};
  const settlementBacklogEvidenceByChannel: Record<string, { eventIds: string[]; settlementIds: string[] }> = {};
  const settlementTotalsEvidenceByChannel: Record<string, { eventIds: string[]; settlementIds: string[] }> = {};
  const settlementTrendByChannel: Record<
    string,
    {
      recentGrossCents: number;
      recentFeesCents: number;
      baselineGrossCents: number;
      baselineFeesCents: number;
      recentEventIds: string[];
      baselineEventIds: string[];
      recentSettlementIds: string[];
      baselineSettlementIds: string[];
    }
  > = {};

  for (const e of failedEvents) {
    channelFailures[e.channel] = (channelFailures[e.channel] ?? 0) + 1;
    const failureEvidence = ensureEvidenceBucket(failureEvidenceByChannel, e.channel, () => ({ eventIds: [] }));
    pushSample(failureEvidence.eventIds, e.id);

    if (e.eventType === "delivery.order.action.requested" && (e.status === "dead_letter" || e.status === "failed")) {
      actionDeadLettersByChannel[e.channel] = (actionDeadLettersByChannel[e.channel] ?? 0) + 1;
      const actionEvidence = ensureEvidenceBucket(actionEvidenceByChannel, e.channel, () => ({ eventIds: [] }));
      pushSample(actionEvidence.eventIds, e.id);
    }

    if (e.eventType.includes("settlement") && (e.status === "dead_letter" || e.status === "failed")) {
      settlementDeadLettersByChannel[e.channel] = (settlementDeadLettersByChannel[e.channel] ?? 0) + 1;
      const settlementEvidence = ensureEvidenceBucket(settlementFailureEvidenceByChannel, e.channel, () => ({
        eventIds: [],
        settlementIds: []
      }));
      pushSample(settlementEvidence.eventIds, e.id);
      const settlementId = extractSettlementId(e.payload);
      if (settlementId) {
        pushSample(settlementEvidence.settlementIds, settlementId);
      }
    }
  }

  for (const event of settlementBacklogEvents) {
    const backlogEvidence = ensureEvidenceBucket(settlementBacklogEvidenceByChannel, event.channel, () => ({
      eventIds: [],
      settlementIds: []
    }));
    pushSample(backlogEvidence.eventIds, event.id);
    const settlementId = extractSettlementId(event.payload);
    if (settlementId) {
      pushSample(backlogEvidence.settlementIds, settlementId);
    }
  }

  for (const settlementEvent of settlementProcessed) {
    const settlementPayload = extractSettlementPayload(settlementEvent.payload);

    const grossCents = typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    const feesCents = typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;

    if (!settlementTotalsByChannel[settlementEvent.channel]) {
      settlementTotalsByChannel[settlementEvent.channel] = { grossCents: 0, feesCents: 0 };
    }

    const totals = settlementTotalsByChannel[settlementEvent.channel]!;
    totals.grossCents += grossCents;
    totals.feesCents += feesCents;

    const totalsEvidence = ensureEvidenceBucket(settlementTotalsEvidenceByChannel, settlementEvent.channel, () => ({
      eventIds: [],
      settlementIds: []
    }));
    pushSample(totalsEvidence.eventIds, settlementEvent.id);
    const settlementId = extractSettlementId(settlementEvent.payload);
    if (settlementId) {
      pushSample(totalsEvidence.settlementIds, settlementId);
    }
  }

  for (const settlementEvent of settlementProcessedTrend) {
    const settlementPayload = extractSettlementPayload(settlementEvent.payload);

    const grossCents = typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    const feesCents = typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;

    if (!settlementTrendByChannel[settlementEvent.channel]) {
      settlementTrendByChannel[settlementEvent.channel] = {
        recentGrossCents: 0,
        recentFeesCents: 0,
        baselineGrossCents: 0,
        baselineFeesCents: 0,
        recentEventIds: [],
        baselineEventIds: [],
        recentSettlementIds: [],
        baselineSettlementIds: []
      };
    }

    const trend = settlementTrendByChannel[settlementEvent.channel]!;
    const settlementId = extractSettlementId(settlementEvent.payload);
    if (settlementEvent.createdAt >= since) {
      trend.recentGrossCents += grossCents;
      trend.recentFeesCents += feesCents;
      pushSample(trend.recentEventIds, settlementEvent.id);
      if (settlementId) {
        pushSample(trend.recentSettlementIds, settlementId);
      }
    } else {
      trend.baselineGrossCents += grossCents;
      trend.baselineFeesCents += feesCents;
      pushSample(trend.baselineEventIds, settlementEvent.id);
      if (settlementId) {
        pushSample(trend.baselineSettlementIds, settlementId);
      }
    }
  }

  for (const [channel, count] of Object.entries(channelFailures)) {
    const severity: AlertSeverity = count > 10 ? "critical" : count > 3 ? "warning" : "info";
    alerts.push({
      severity,
      channel,
      message: `${count} failed event(s) in the last 24 h`,
      evidence: {
        eventIds: failureEvidenceByChannel[channel]?.eventIds ?? [],
        apiPath: `/api/admin/integrations/dead-letter?channel=${channel}&limit=50`,
        artifactPath: `artifacts/delivery-replay/${channel}`
      }
    });
  }

  for (const [channel, count] of Object.entries(actionDeadLettersByChannel)) {
    const severity: AlertSeverity = count > 5 ? "critical" : count > 1 ? "warning" : "info";
    alerts.push({
      severity,
      channel,
      message: `${count} delivery action event(s) reached dead-letter in the last 24 h`,
      evidence: {
        eventIds: actionEvidenceByChannel[channel]?.eventIds ?? [],
        apiPath: `/api/admin/integrations/dead-letter?channel=${channel}&eventType=delivery.order.action.requested&limit=50`,
        artifactPath: `artifacts/delivery-replay/${channel}/delivery-action-replay.json`
      }
    });
  }

  for (const [channel, count] of Object.entries(settlementDeadLettersByChannel)) {
    const severity: AlertSeverity = count > 3 ? "critical" : count > 0 ? "warning" : "info";
    alerts.push({
      severity,
      channel,
      message: `${count} delivery settlement event(s) failed or reached dead-letter in the last 24 h`,
      evidence: {
        eventIds: settlementFailureEvidenceByChannel[channel]?.eventIds ?? [],
        settlementIds: settlementFailureEvidenceByChannel[channel]?.settlementIds ?? [],
        apiPath: `/api/admin/integrations/dead-letter?channel=${channel}&eventType=settlement&limit=50`,
        artifactPath: `artifacts/delivery-replay/${channel}/delivery-settlement-replay.json`
      }
    });
  }

  for (const row of settlementBacklog) {
    const count = row._count._all;
    const severity: AlertSeverity = count > 15 ? "critical" : count > 5 ? "warning" : "info";
    const backlogFrom = since.toISOString().slice(0, 10);
    alerts.push({
      severity,
      channel: row.channel,
      message: `${count} delivery settlement event(s) are still queued/pending`,
      evidence: {
        eventIds: settlementBacklogEvidenceByChannel[row.channel]?.eventIds ?? [],
        settlementIds: settlementBacklogEvidenceByChannel[row.channel]?.settlementIds ?? [],
        apiPath: `/api/admin/integrations/settlements?channel=${row.channel}&status=queued&from=${backlogFrom}`,
        artifactPath: `artifacts/delivery-replay/${row.channel}/delivery-settlement-replay.json`
      }
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

    const severity: AlertSeverity = feeRatio >= 0.45 ? "critical" : "warning";
    const from = since.toISOString().slice(0, 10);
    alerts.push({
      severity,
      channel,
      message: `Settlement fee ratio is ${(feeRatio * 100).toFixed(1)}% in the last 24 h`,
      evidence: {
        eventIds: settlementTotalsEvidenceByChannel[channel]?.eventIds ?? [],
        settlementIds: settlementTotalsEvidenceByChannel[channel]?.settlementIds ?? [],
        apiPath: `/api/admin/integrations/settlements?channel=${channel}&status=processed&from=${from}`,
        artifactPath: `artifacts/delivery-replay/${channel}/delivery-settlement-replay.json`
      }
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

    const severity: AlertSeverity = feeRateDelta >= 0.15 ? "critical" : "warning";
    const baselineFrom = baselineSince.toISOString().slice(0, 10);
    const recentFrom = since.toISOString().slice(0, 10);
    alerts.push({
      severity,
      channel,
      message: `Settlement fee ratio increased ${(feeRateDelta * 100).toFixed(1)} pts vs 7-day baseline (${(recentFeeRate * 100).toFixed(1)}% vs ${(baselineFeeRate * 100).toFixed(1)}%)`,
      evidence: {
        eventIds: trend.recentEventIds,
        settlementIds: trend.recentSettlementIds,
        apiPath: `/api/admin/integrations/settlements?channel=${channel}&status=processed&from=${recentFrom}`,
        baselineApiPath: `/api/admin/integrations/settlements?channel=${channel}&status=processed&from=${baselineFrom}&to=${recentFrom}`,
        artifactPath: `artifacts/delivery-replay/${channel}`
      }
    });
  }

  const summary = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length
  };

  return NextResponse.json({ summary, alerts });
}
