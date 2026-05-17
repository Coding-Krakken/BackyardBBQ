import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const deliveryChannels = ["doordash", "ubereats", "grubhub"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "50");
  const channelParam = searchParams.get("channel");
  const statusParam = searchParams.get("status");
  const dateFromParam = searchParams.get("from");
  const dateToParam = searchParams.get("to");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 200) : 50;

  const where: Prisma.IntegrationEventWhereInput = {
    channel: { in: [...deliveryChannels] },
    eventType: { contains: "settlement" }
  };

  if (channelParam && deliveryChannels.includes(channelParam as (typeof deliveryChannels)[number])) {
    where.channel = channelParam;
  }

  if (statusParam && statusParam.trim().length > 0) {
    where.status = statusParam;
  }

  if (dateFromParam || dateToParam) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (dateFromParam) {
      createdAt.gte = new Date(`${dateFromParam}T00:00:00.000Z`);
    }
    if (dateToParam) {
      createdAt.lte = new Date(`${dateToParam}T23:59:59.999Z`);
    }
    where.createdAt = createdAt;
  }

  const rows = await prisma.integrationEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      eventType: true,
      status: true,
      createdAt: true,
      payload: true
    }
  });

  const normalizedRows = rows.map((row) => {
      const payload = row.payload as Record<string, unknown>;
      const settlementPayload =
        payload.settlement && typeof payload.settlement === "object"
          ? (payload.settlement as Record<string, unknown>)
          : payload;

      return {
        id: row.id,
        channel: row.channel,
        eventType: row.eventType,
        status: row.status,
        createdAt: row.createdAt,
        settlementId:
          typeof settlementPayload.settlementId === "string" ? settlementPayload.settlementId : null,
        payoutId: typeof settlementPayload.payoutId === "string" ? settlementPayload.payoutId : null,
        grossCents: typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0,
        feesCents: typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0,
        netCents: typeof settlementPayload.netCents === "number" ? settlementPayload.netCents : 0,
        currency: typeof settlementPayload.currency === "string" ? settlementPayload.currency : "usd",
        settledAt:
          typeof settlementPayload.settledAt === "string"
            ? settlementPayload.settledAt
            : typeof payload.receivedAt === "string"
              ? payload.receivedAt
              : row.createdAt.toISOString(),
        orderExternalId:
          typeof settlementPayload.externalOrderId === "string"
            ? settlementPayload.externalOrderId
            : null,
        correlationId: typeof payload.correlationId === "string" ? payload.correlationId : null
      };
    });

  const summary = normalizedRows.reduce(
    (acc, row) => {
      acc.totalCount += 1;
      acc.grossCents += row.grossCents;
      acc.feesCents += row.feesCents;
      acc.netCents += row.netCents;
      if (row.status === "processed") {
        acc.processedCount += 1;
      }
      if (row.status === "queued" || row.status === "pending") {
        acc.queuedCount += 1;
      }
      if (row.status === "dead_letter" || row.status === "failed") {
        acc.failedCount += 1;
      }
      return acc;
    },
    {
      totalCount: 0,
      processedCount: 0,
      queuedCount: 0,
      failedCount: 0,
      grossCents: 0,
      feesCents: 0,
      netCents: 0
    }
  );

  return NextResponse.json({
    summary,
    data: normalizedRows
  });
}
