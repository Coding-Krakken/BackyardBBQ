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

  const refundedAgg = await prisma.paymentTransaction.aggregate({
    _sum: { amountCents: true },
    where: {
      status: { in: ["refunded", "partially_refunded"] },
      createdAt: { gte: dayStart, lte: dayEnd }
    }
  });

  const grossSalesCents = orders.reduce((sum: number, o: { totalCents: number }) => sum + o.totalCents, 0);
  const refundedCents = refundedAgg._sum.amountCents ?? 0;

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
      netSalesCents: grossSalesCents - refundedCents
    },
    bySource: Object.entries(bySourceMap).map(([source, v]) => ({ source, ...v }))
  });
}
