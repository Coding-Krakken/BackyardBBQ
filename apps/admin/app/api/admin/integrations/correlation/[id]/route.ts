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
  const limitParam = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 1000) : 200;

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
    eventTypes: {} as Record<string, number>
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

  return NextResponse.json({
    correlationId,
    limit,
    summary,
    data
  });
}
