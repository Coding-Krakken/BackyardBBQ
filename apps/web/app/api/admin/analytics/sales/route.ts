import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) return null;
  return session;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "14"), 90);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { notIn: ["cancelled"] } },
    select: {
      id: true, source: true, totalCents: true, createdAt: true,
      items: { select: { menuItemName: true, quantity: true, unitPriceCents: true } }
    }
  });

  const totals = { orders: orders.length, grossSalesCents: 0, averageOrderValueCents: 0 };
  const dailyMap: Record<string, { orders: number; grossSalesCents: number }> = {};
  const sourceMap: Record<string, { orders: number; grossSalesCents: number }> = {};
  const itemMap: Record<string, { quantity: number; revenueCents: number }> = {};

  for (const o of orders) {
    totals.grossSalesCents += o.totalCents;
    const day = o.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { orders: 0, grossSalesCents: 0 };
    dailyMap[day].orders += 1;
    dailyMap[day].grossSalesCents += o.totalCents;
    if (!sourceMap[o.source]) sourceMap[o.source] = { orders: 0, grossSalesCents: 0 };
    sourceMap[o.source].orders += 1;
    sourceMap[o.source].grossSalesCents += o.totalCents;
    for (const item of o.items) {
      if (!itemMap[item.menuItemName]) itemMap[item.menuItemName] = { quantity: 0, revenueCents: 0 };
      itemMap[item.menuItemName].quantity += item.quantity;
      itemMap[item.menuItemName].revenueCents += item.quantity * item.unitPriceCents;
    }
  }

  totals.averageOrderValueCents = orders.length > 0 ? Math.round(totals.grossSalesCents / orders.length) : 0;

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const bySource = Object.entries(sourceMap).map(([source, v]) => ({ source, ...v }));

  const topItems = Object.entries(itemMap)
    .sort(([, a], [, b]) => b.quantity - a.quantity)
    .slice(0, 10)
    .map(([name, v]) => ({ name, ...v }));

  return NextResponse.json({ windowDays: days, totals, daily, bySource, topItems });
}
