import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const deliveryChannels = ["doordash", "ubereats", "grubhub"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const channelParam = searchParams.get("channel");
  const statusParam = searchParams.get("status");
  const dateFromParam = searchParams.get("from");
  const dateToParam = searchParams.get("to");

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
    take: 500,
    select: {
      id: true,
      channel: true,
      eventType: true,
      status: true,
      createdAt: true,
      payload: true
    }
  });

  const header = [
    "id",
    "channel",
    "eventType",
    "status",
    "settlementId",
    "payoutId",
    "orderExternalId",
    "grossCents",
    "feesCents",
    "netCents",
    "currency",
    "settledAt",
    "createdAt"
  ].join(",");

  const lines = rows.map((row) => {
    const payload = row.payload as Record<string, unknown>;
    const settlementPayload =
      payload.settlement && typeof payload.settlement === "object"
        ? (payload.settlement as Record<string, unknown>)
        : payload;

    const settlementId = typeof settlementPayload.settlementId === "string" ? settlementPayload.settlementId : "";
    const payoutId = typeof settlementPayload.payoutId === "string" ? settlementPayload.payoutId : "";
    const orderExternalId =
      typeof settlementPayload.externalOrderId === "string"
        ? settlementPayload.externalOrderId
        : typeof payload.orderExternalId === "string"
          ? payload.orderExternalId
          : "";
    const grossCents = typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    const feesCents = typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;
    const netCents = typeof settlementPayload.netCents === "number" ? settlementPayload.netCents : 0;
    const currency = typeof settlementPayload.currency === "string" ? settlementPayload.currency : "usd";
    const settledAt = typeof settlementPayload.settledAt === "string" ? settlementPayload.settledAt : "";

    return [
      row.id,
      row.channel,
      row.eventType,
      row.status,
      settlementId,
      payoutId,
      orderExternalId,
      grossCents,
      feesCents,
      netCents,
      currency,
      settledAt,
      row.createdAt.toISOString()
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=delivery-settlements.csv"
    }
  });
}
