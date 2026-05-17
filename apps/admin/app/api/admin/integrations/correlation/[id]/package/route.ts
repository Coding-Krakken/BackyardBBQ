import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

type TimelineRow = {
  id: string;
  channel: string;
  eventType: string;
  status: string;
  orderId: string | null;
  settlementId: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

function extractSettlementId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (record.settlement && typeof record.settlement === "object") {
    const settlementRecord = record.settlement as Record<string, unknown>;
    return typeof settlementRecord.settlementId === "string" ? settlementRecord.settlementId : null;
  }

  return typeof record.settlementId === "string" ? record.settlementId : null;
}

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildTimelineCsv(correlationId: string, rows: TimelineRow[]) {
  const header = [
    "correlationId",
    "eventId",
    "channel",
    "eventType",
    "status",
    "orderId",
    "settlementId",
    "createdAt",
    "payload"
  ];

  const dataRows = rows.map((row) => [
    correlationId,
    row.id,
    row.channel,
    row.eventType,
    row.status,
    row.orderId,
    row.settlementId,
    row.createdAt,
    row.payload
  ]);

  return [header, ...dataRows]
    .map((line) => line.map((value) => toCsvValue(value)).join(","))
    .join("\n");
}

function buildSettlementsCsv(correlationId: string, rows: TimelineRow[]) {
  const header = [
    "correlationId",
    "eventId",
    "channel",
    "status",
    "settlementId",
    "grossCents",
    "feesCents",
    "netCents",
    "currency",
    "settledAt",
    "createdAt"
  ];

  const settlementRows: Array<Array<string | number>> = [];
  for (const row of rows) {
    const settlement = row.payload.settlement;
    if (!settlement || typeof settlement !== "object") {
      continue;
    }

    const settlementPayload = settlement as Record<string, unknown>;
    settlementRows.push([
      correlationId,
      row.id,
      row.channel,
      row.status,
      typeof settlementPayload.settlementId === "string" ? settlementPayload.settlementId : "",
      typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0,
      typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0,
      typeof settlementPayload.netCents === "number" ? settlementPayload.netCents : 0,
      typeof settlementPayload.currency === "string" ? settlementPayload.currency : "usd",
      typeof settlementPayload.settledAt === "string" ? settlementPayload.settledAt : "",
      row.createdAt
    ]);
  }

  return [header, ...settlementRows]
    .map((line) => line.map((value) => toCsvValue(value)).join(","))
    .join("\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const correlationId = params.id?.trim();
  if (!correlationId) {
    return NextResponse.json({ message: "Missing correlation ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "1000");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 10000) : 1000;

  const where: Prisma.IntegrationEventWhereInput = {
    payload: {
      path: ["correlationId"],
      equals: correlationId
    }
  };

  const events = await prisma.integrationEvent.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      eventType: true,
      status: true,
      orderId: true,
      createdAt: true,
      payload: true
    }
  });

  const summary = {
    total: events.length,
    channels: {} as Record<string, number>,
    statuses: {} as Record<string, number>,
    eventTypes: {} as Record<string, number>,
    firstSeenAt: null as string | null,
    lastSeenAt: null as string | null,
    durationMs: 0,
    settlementTotals: {
      grossCents: 0,
      feesCents: 0,
      netCents: 0,
      count: 0
    }
  };

  const timeline: TimelineRow[] = events.map((event) => {
    summary.channels[event.channel] = (summary.channels[event.channel] ?? 0) + 1;
    summary.statuses[event.status] = (summary.statuses[event.status] ?? 0) + 1;
    summary.eventTypes[event.eventType] = (summary.eventTypes[event.eventType] ?? 0) + 1;

    const payload = event.payload as Record<string, unknown>;
    return {
      id: event.id,
      channel: event.channel,
      eventType: event.eventType,
      status: event.status,
      orderId: event.orderId,
      settlementId: extractSettlementId(payload),
      createdAt: event.createdAt.toISOString(),
      payload
    };
  });

  if (timeline.length > 0) {
    summary.firstSeenAt = timeline[0]?.createdAt ?? null;
    summary.lastSeenAt = timeline[timeline.length - 1]?.createdAt ?? null;
    if (summary.firstSeenAt && summary.lastSeenAt) {
      const first = new Date(summary.firstSeenAt).getTime();
      const last = new Date(summary.lastSeenAt).getTime();
      summary.durationMs = Number.isFinite(first) && Number.isFinite(last) ? Math.max(0, last - first) : 0;
    }
  }

  for (const row of timeline) {
    const settlement = row.payload.settlement;
    if (!settlement || typeof settlement !== "object") {
      continue;
    }

    const settlementPayload = settlement as Record<string, unknown>;
    summary.settlementTotals.grossCents +=
      typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    summary.settlementTotals.feesCents +=
      typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;
    summary.settlementTotals.netCents +=
      typeof settlementPayload.netCents === "number" ? settlementPayload.netCents : 0;
    summary.settlementTotals.count += 1;
  }

  const timelineCsv = buildTimelineCsv(correlationId, timeline);
  const settlementsCsv = buildSettlementsCsv(correlationId, timeline);
  const timelineCsvSha256 = createHash("sha256").update(timelineCsv, "utf8").digest("hex");
  const settlementsCsvSha256 = createHash("sha256").update(settlementsCsv, "utf8").digest("hex");
  const manifest = {
    correlationId,
    eventCount: timeline.length,
    channels: Object.keys(summary.channels).sort(),
    generatedAt: new Date().toISOString(),
    digests: {
      timelineCsvSha256,
      settlementsCsvSha256
    }
  };

  return NextResponse.json({
    correlationId,
    packagedAt: manifest.generatedAt,
    limit,
    summary,
    manifest,
    package: {
      timelineCsvSha256,
      settlementsCsvSha256,
      timelineCsv,
      settlementsCsv
    },
    timeline
  });
}
