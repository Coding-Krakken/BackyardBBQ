import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { evaluateCorrelationContract } from "@/lib/integrations/correlation-contract";

type ContractHealthRow = {
  correlationId: string;
  scorePercent: number;
  passed: boolean;
  passedCount: number;
  failedCount: number;
  failedChecks: string[];
  totalEvents: number;
  channels: string[];
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

type ChannelStat = {
  total: number;
  failing: number;
};

function readCorrelationId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  return typeof record.correlationId === "string" && record.correlationId.length > 0
    ? record.correlationId
    : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "25");
  const daysParam = Number(searchParams.get("days") ?? "3");
  const onlyFailing = searchParams.get("onlyFailing") === "true";
  const channelFilter = searchParams.get("channel")?.trim().toLowerCase();
  const minScoreParam = Number(searchParams.get("minScore") ?? "0");

  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 100) : 25;
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.trunc(daysParam), 1), 30) : 3;
  const minScore = Number.isFinite(minScoreParam)
    ? Math.min(Math.max(Math.trunc(minScoreParam), 0), 100)
    : 0;
  const allowedChannels = ["doordash", "ubereats", "grubhub"] as const;
  const channel = allowedChannels.includes(channelFilter as (typeof allowedChannels)[number])
    ? (channelFilter as (typeof allowedChannels)[number])
    : null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where: Prisma.IntegrationEventWhereInput = {
    createdAt: { gte: since },
    channel: {
      in: channel ? [channel] : ["doordash", "ubereats", "grubhub"]
    }
  };

  const events = await prisma.integrationEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      channel: true,
      eventType: true,
      status: true,
      payload: true,
      createdAt: true
    }
  });

  const byCorrelation = new Map<string, typeof events>();
  for (const event of events) {
    const correlationId = readCorrelationId(event.payload);
    if (!correlationId) {
      continue;
    }

    const bucket = byCorrelation.get(correlationId) ?? [];
    bucket.push(event);
    byCorrelation.set(correlationId, bucket);
  }

  const rows: ContractHealthRow[] = [];
  const failedCheckCounts = new Map<string, number>();
  const channelStats = new Map<string, ChannelStat>();

  for (const [correlationId, correlationEvents] of byCorrelation) {
    const ordered = [...correlationEvents].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const contract = evaluateCorrelationContract(ordered, correlationId);
    const failedChecks = contract.checks.filter((check) => !check.passed).map((check) => check.label);

    if (onlyFailing && contract.result.failedCount === 0) {
      continue;
    }

    if (contract.result.scorePercent < minScore) {
      continue;
    }

    const row: ContractHealthRow = {
      correlationId,
      scorePercent: contract.result.scorePercent,
      passed: contract.result.passed,
      passedCount: contract.result.passedCount,
      failedCount: contract.result.failedCount,
      failedChecks,
      totalEvents: contract.summary.totalEvents,
      channels: contract.summary.channels,
      firstSeenAt: contract.summary.firstSeenAt,
      lastSeenAt: contract.summary.lastSeenAt
    };

    rows.push(row);

    for (const failedCheck of failedChecks) {
      failedCheckCounts.set(failedCheck, (failedCheckCounts.get(failedCheck) ?? 0) + 1);
    }

    for (const rowChannel of row.channels) {
      const stat = channelStats.get(rowChannel) ?? { total: 0, failing: 0 };
      stat.total += 1;
      if (!row.passed) {
        stat.failing += 1;
      }
      channelStats.set(rowChannel, stat);
    }
  }

  rows.sort((a, b) => {
    const aLast = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bLast = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    return bLast - aLast;
  });

  const limited = rows.slice(0, limit);
  const failingCount = rows.filter((row) => !row.passed).length;
  const averageScorePercent = rows.length > 0
    ? Math.round(rows.reduce((sum, row) => sum + row.scorePercent, 0) / rows.length)
    : 0;
  const failRatePercent = rows.length > 0 ? Math.round((failingCount / rows.length) * 100) : 0;

  const topFailedChecks = [...failedCheckCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const channelBreakdown = [...channelStats.entries()]
    .map(([name, stat]) => ({
      name,
      totalCorrelations: stat.total,
      failingCorrelations: stat.failing,
      failRatePercent: stat.total > 0 ? Math.round((stat.failing / stat.total) * 100) : 0
    }))
    .sort((a, b) => {
      if (b.failRatePercent !== a.failRatePercent) {
        return b.failRatePercent - a.failRatePercent;
      }
      return b.totalCorrelations - a.totalCorrelations;
    });

  return NextResponse.json({
    days,
    limit,
    onlyFailing,
    channel,
    minScore,
    count: limited.length,
    summary: {
      totalCorrelations: rows.length,
      failingCorrelations: failingCount,
      passingCorrelations: Math.max(0, rows.length - failingCount),
      averageScorePercent,
      failRatePercent,
      topFailedChecks,
      channelBreakdown
    },
    data: limited
  });
}
