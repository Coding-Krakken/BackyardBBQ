import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const horizonDays = Math.min(parseInt(searchParams.get("days") ?? "7"), 30);

  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { notIn: ["cancelled"] } },
    select: { totalCents: true, createdAt: true }
  });

  const dailyMap: Record<string, { orders: number; salesCents: number }> = {};
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { orders: 0, salesCents: 0 };
    const fe = dailyMap[day]!;
    fe.orders += 1;
    fe.salesCents += o.totalCents;
  }

  const days = Object.values(dailyMap);
  const avg = days.length > 0 ? days.reduce((s, d) => s + d.salesCents, 0) / days.length : 0;
  const avgOrders = days.length > 0 ? days.reduce((s, d) => s + d.orders, 0) / days.length : 0;

  const rows = ["date,predictedOrders,predictedSalesCents,predictedSalesUSD,confidence"];
  for (let i = 1; i <= horizonDays; i++) {
    const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const d = new Date(date).getDay();
    const m = d === 0 || d === 6 ? 1.25 : 1.0;
    const predictedOrders = Math.round(avgOrders * m);
    const predictedSalesCents = Math.round(avg * m);
    const confidence = days.length >= 14 ? 0.75 : 0.5;
    rows.push([date, predictedOrders, predictedSalesCents, (predictedSalesCents / 100).toFixed(2), confidence].join(","));
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="forecast-${horizonDays}d.csv"`
    }
  });
}
