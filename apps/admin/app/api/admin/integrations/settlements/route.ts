import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const deliveryChannels = ["doordash", "ubereats", "grubhub"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 200) : 50;

  const rows = await prisma.integrationEvent.findMany({
    where: {
      channel: { in: [...deliveryChannels] },
      eventType: { contains: "settlement" }
    },
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

  return NextResponse.json({
    data: rows.map((row) => {
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
            : null
      };
    })
  });
}
