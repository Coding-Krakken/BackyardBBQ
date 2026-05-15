import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) return null;
  return session;
}

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
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

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

  const grossSalesCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const refundedCents = refundedAgg._sum.amountCents ?? 0;

  const bySourceMap: Record<string, { orders: number; totalCents: number }> = {};
  for (const o of orders) {
    if (!bySourceMap[o.source]) bySourceMap[o.source] = { orders: 0, totalCents: 0 };
    bySourceMap[o.source].orders += 1;
    bySourceMap[o.source].totalCents += o.totalCents;
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
