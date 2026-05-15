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
  const windowDays = Math.min(parseInt(searchParams.get("days") ?? "21"), 90);

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { notIn: ["cancelled"] } },
    select: { totalCents: true, createdAt: true }
  });

  // Group by day
  const dailyMap: Record<string, { orders: number; salesCents: number }> = {};
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { orders: 0, salesCents: 0 };
    dailyMap[day].orders += 1;
    dailyMap[day].salesCents += o.totalCents;
  }

  const days = Object.values(dailyMap);
  if (days.length === 0) {
    return NextResponse.json({ windowDays, summary: { critical: 0, warning: 0, info: 0 }, anomalies: [] });
  }

  const avgOrders = days.reduce((s, d) => s + d.orders, 0) / days.length;
  const avgSales = days.reduce((s, d) => s + d.salesCents, 0) / days.length;
  const stdOrders = Math.sqrt(days.reduce((s, d) => s + Math.pow(d.orders - avgOrders, 2), 0) / days.length);
  const stdSales = Math.sqrt(days.reduce((s, d) => s + Math.pow(d.salesCents - avgSales, 2), 0) / days.length);

  const anomalies: Array<{ severity: "critical" | "warning" | "info"; title: string; detail: string }> = [];

  for (const [date, { orders: o, salesCents }] of Object.entries(dailyMap)) {
    const zOrders = stdOrders > 0 ? (o - avgOrders) / stdOrders : 0;
    const zSales = stdSales > 0 ? (salesCents - avgSales) / stdSales : 0;
    const maxZ = Math.max(Math.abs(zOrders), Math.abs(zSales));
    if (maxZ > 3) {
      anomalies.push({ severity: "critical", title: `Significant spike on ${date}`, detail: `${o} orders, $${(salesCents / 100).toFixed(2)} sales (z=${maxZ.toFixed(1)})` });
    } else if (maxZ > 2) {
      anomalies.push({ severity: "warning", title: `Unusual activity on ${date}`, detail: `${o} orders, $${(salesCents / 100).toFixed(2)} sales (z=${maxZ.toFixed(1)})` });
    }
  }

  const summary = {
    critical: anomalies.filter((a) => a.severity === "critical").length,
    warning: anomalies.filter((a) => a.severity === "warning").length,
    info: anomalies.filter((a) => a.severity === "info").length
  };

  return NextResponse.json({ windowDays, summary, anomalies });
}
