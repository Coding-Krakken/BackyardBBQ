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

  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 100) : 25;
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.trunc(daysParam), 1), 30) : 3;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where: Prisma.IntegrationEventWhereInput = {
    createdAt: { gte: since },
    channel: {
      in: ["doordash", "ubereats", "grubhub"]
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
  for (const [correlationId, correlationEvents] of byCorrelation) {
    const ordered = [...correlationEvents].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const contract = evaluateCorrelationContract(ordered, correlationId);
    const failedChecks = contract.checks.filter((check) => !check.passed).map((check) => check.label);

    if (onlyFailing && contract.result.failedCount === 0) {
      continue;
    }

    rows.push({
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
    });
  }

  rows.sort((a, b) => {
    const aLast = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bLast = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    return bLast - aLast;
  });

  const limited = rows.slice(0, limit);

  return NextResponse.json({
    days,
    limit,
    onlyFailing,
    count: limited.length,
    data: limited
  });
}
