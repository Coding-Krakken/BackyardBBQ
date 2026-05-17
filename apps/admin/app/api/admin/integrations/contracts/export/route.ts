import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { evaluateCorrelationContract } from "@/lib/integrations/correlation-contract";

type Row = {
  correlationId: string;
  scorePercent: number;
  passed: boolean;
  failedCount: number;
  failedChecks: string;
  totalEvents: number;
  channels: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
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

function csvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "\"\"";
  }
  const raw = String(value).replace(/"/g, '""');
  return `"${raw}"`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days") ?? "3");
  const onlyFailing = searchParams.get("onlyFailing") === "true";
  const channelFilter = searchParams.get("channel")?.trim().toLowerCase();
  const minScoreParam = Number(searchParams.get("minScore") ?? "0");

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
    take: 10000,
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

  const rows: Row[] = [];
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

    rows.push({
      correlationId,
      scorePercent: contract.result.scorePercent,
      passed: contract.result.passed,
      failedCount: contract.result.failedCount,
      failedChecks: failedChecks.join(" | "),
      totalEvents: contract.summary.totalEvents,
      channels: contract.summary.channels.join(","),
      firstSeenAt: contract.summary.firstSeenAt,
      lastSeenAt: contract.summary.lastSeenAt
    });
  }

  rows.sort((a, b) => {
    const aLast = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bLast = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    return bLast - aLast;
  });

  const header = [
    "correlationId",
    "scorePercent",
    "passed",
    "failedCount",
    "failedChecks",
    "totalEvents",
    "channels",
    "firstSeenAt",
    "lastSeenAt"
  ];

  const csvLines = [
    header.map((value) => csvValue(value)).join(","),
    ...rows.map((row) =>
      [
        row.correlationId,
        row.scorePercent,
        row.passed,
        row.failedCount,
        row.failedChecks,
        row.totalEvents,
        row.channels,
        row.firstSeenAt,
        row.lastSeenAt
      ]
        .map((value) => csvValue(value))
        .join(",")
    )
  ];

  const csv = `${csvLines.join("\n")}\n`;
  const fileName = `contracts-feed-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=${fileName}`
    }
  });
}
