import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'accounting']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const dayStart = new Date(`${dateParam}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateParam}T23:59:59.999Z`);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: dayStart, lte: dayEnd }, status: { notIn: ["cancelled"] } },
    select: { id: true, source: true, status: true, totalCents: true, createdAt: true }
  });

  const [refundedAgg, settlementEvents] = await Promise.all([
    prisma.paymentTransaction.aggregate({
      _sum: { amountCents: true },
      where: {
        status: { in: ["refunded", "partially_refunded"] },
        createdAt: { gte: dayStart, lte: dayEnd }
      }
    }),
    prisma.integrationEvent.findMany({
      where: {
        channel: { in: ["doordash", "ubereats", "grubhub"] },
        eventType: { contains: "settlement" },
        status: "processed",
        createdAt: { gte: dayStart, lte: dayEnd }
      },
      select: {
        channel: true,
        payload: true
      }
    })
  ]);

  const grossSalesCents = orders.reduce((sum, row) => sum + row.totalCents, 0);
  const refundedCents = refundedAgg._sum.amountCents ?? 0;

  const settlementByChannelMap: Record<string, { grossCents: number; feesCents: number; netCents: number }> = {};
  let settlementNetCents = 0;

  for (const event of settlementEvents) {
    const payload = event.payload as Record<string, unknown>;
    const settlementPayload =
      payload.settlement && typeof payload.settlement === "object"
        ? (payload.settlement as Record<string, unknown>)
        : payload;

    const grossCents = typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    const feesCents = typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;
    const netCents = typeof settlementPayload.netCents === "number" ? settlementPayload.netCents : 0;
    settlementNetCents += netCents;

    if (!settlementByChannelMap[event.channel]) {
      settlementByChannelMap[event.channel] = { grossCents: 0, feesCents: 0, netCents: 0 };
    }

    const totals = settlementByChannelMap[event.channel]!;
    totals.grossCents += grossCents;
    totals.feesCents += feesCents;
    totals.netCents += netCents;
  }

  const netSalesCents = Math.max(0, grossSalesCents - refundedCents);
  const netAfterSettlementCents = Math.max(0, netSalesCents - settlementNetCents);

  const rows = ["id,source,status,totalCents,totalUSD,createdAt"];
  for (const o of orders) {
    rows.push([
      o.id,
      o.source,
      o.status,
      o.totalCents,
      (o.totalCents / 100).toFixed(2),
      o.createdAt.toISOString()
    ].join(","));
  }

  rows.push("");
  rows.push("summaryMetric,value");
  rows.push(`grossSalesCents,${grossSalesCents}`);
  rows.push(`refundedCents,${refundedCents}`);
  rows.push(`netSalesCents,${netSalesCents}`);
  rows.push(`settlementNetCents,${settlementNetCents}`);
  rows.push(`netAfterSettlementCents,${netAfterSettlementCents}`);

  rows.push("");
  rows.push("channel,grossCents,feesCents,netCents");
  for (const [channel, totals] of Object.entries(settlementByChannelMap)) {
    rows.push(`${channel},${totals.grossCents},${totals.feesCents},${totals.netCents}`);
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="daily-close-${dateParam}.csv"`
    }
  });
}
