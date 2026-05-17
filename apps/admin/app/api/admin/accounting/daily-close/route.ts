import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

// We store finalized daily closes as an IntegrationEvent with channel="accounting" and eventType="daily_close"
async function getFinalizedDates(): Promise<Set<string>> {
  const events = await prisma.integrationEvent.findMany({
    where: { channel: "accounting", eventType: "daily_close", status: "finalized" },
    select: { payload: true }
  });
  const dates = new Set<string>();
  for (const e of events) {
    const p = e.payload as Record<string, unknown>;
    if (typeof p.date === "string") dates.add(p.date);
  }
  return dates;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'accounting']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const dayStart = new Date(`${dateParam}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateParam}T23:59:59.999Z`);

  const [orders, finalizedDates] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd }, status: { notIn: ["cancelled"] } },
      select: { source: true, totalCents: true }
    }),
    getFinalizedDates()
  ]);

  const settlementEvents = await prisma.integrationEvent.findMany({
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
  });

  const refundedAgg = await prisma.paymentTransaction.aggregate({
    _sum: { amountCents: true },
    where: {
      status: { in: ["refunded", "partially_refunded"] },
      createdAt: { gte: dayStart, lte: dayEnd }
    }
  });

  const grossSalesCents = orders.reduce((sum: number, o: { totalCents: number }) => sum + o.totalCents, 0);
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
    const channelTotals = settlementByChannelMap[event.channel]!;
    channelTotals.grossCents += grossCents;
    channelTotals.feesCents += feesCents;
    channelTotals.netCents += netCents;
  }

  const bySourceMap: Record<string, { orders: number; totalCents: number }> = {};
  for (const o of orders) {
    if (!bySourceMap[o.source]) bySourceMap[o.source] = { orders: 0, totalCents: 0 };
    const src = bySourceMap[o.source]!;
    src.orders += 1;
    src.totalCents += o.totalCents;
  }

  return NextResponse.json({
    date: dateParam,
    finalized: finalizedDates.has(dateParam),
    summary: {
      grossSalesCents,
      refundedCents,
      settlementNetCents,
      netSalesCents: grossSalesCents - refundedCents,
      netAfterSettlementCents: Math.max(0, grossSalesCents - refundedCents - settlementNetCents)
    },
    bySource: Object.entries(bySourceMap).map(([source, v]) => ({ source, ...v })),
    settlementByChannel: Object.entries(settlementByChannelMap).map(([channel, totals]) => ({
      channel,
      grossCents: totals.grossCents,
      feesCents: totals.feesCents,
      netCents: totals.netCents
    }))
  });
}
