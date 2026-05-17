import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

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

function buildCsv(correlationId: string, rows: Array<{
  id: string;
  channel: string;
  eventType: string;
  status: string;
  orderId: string | null;
  settlementId: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
}>) {
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
  const limitParam = Number(searchParams.get("limit") ?? "500");
  const format = searchParams.get("format") === "csv" ? "csv" : "json";
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 5000) : 500;

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

  const data = events.map((event) => {
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

  if (data.length > 0) {
    summary.firstSeenAt = data[0]?.createdAt ?? null;
    summary.lastSeenAt = data[data.length - 1]?.createdAt ?? null;
    if (summary.firstSeenAt && summary.lastSeenAt) {
      const first = new Date(summary.firstSeenAt).getTime();
      const last = new Date(summary.lastSeenAt).getTime();
      summary.durationMs = Number.isFinite(first) && Number.isFinite(last) ? Math.max(0, last - first) : 0;
    }
  }

  for (const row of data) {
    const settlement = row.payload.settlement;
    if (!settlement || typeof settlement !== "object") {
      continue;
    }

    const settlementPayload = settlement as Record<string, unknown>;
    const grossCents = typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    const feesCents = typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;
    const netCents = typeof settlementPayload.netCents === "number" ? settlementPayload.netCents : 0;
    summary.settlementTotals.grossCents += grossCents;
    summary.settlementTotals.feesCents += feesCents;
    summary.settlementTotals.netCents += netCents;
    summary.settlementTotals.count += 1;
  }

  if (format === "csv") {
    const csv = buildCsv(correlationId, data);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="correlation-${correlationId}.csv"`
      }
    });
  }

  return NextResponse.json({
    correlationId,
    exportedAt: new Date().toISOString(),
    limit,
    summary,
    data
  });
}
