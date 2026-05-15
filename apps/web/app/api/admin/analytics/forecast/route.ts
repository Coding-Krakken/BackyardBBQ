import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const horizonDays = Math.min(parseInt(searchParams.get("days") ?? "7"), 30);

  // Use the trailing 28 days as baseline
  const trailingDays = 28;
  const since = new Date(Date.now() - trailingDays * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { notIn: ["cancelled"] } },
    select: { totalCents: true, createdAt: true }
  });

  // Group by day to compute daily averages
  const dailyMap: Record<string, { orders: number; salesCents: number }> = {};
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { orders: 0, salesCents: 0 };
    const fd = dailyMap[day]!;
    fd.orders += 1;
    fd.salesCents += o.totalCents;
  }

  const days = Object.values(dailyMap);
  const trailingAverageOrders = days.length > 0 ? days.reduce((s, d) => s + d.orders, 0) / days.length : 0;
  const trailingAverageSalesCents = days.length > 0 ? days.reduce((s, d) => s + d.salesCents, 0) / days.length : 0;

  const forecast = Array.from({ length: horizonDays }, (_, i) => {
    const date = new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // Simple flat forecast with slight weekend boost
    const d = new Date(date).getDay();
    const weekendMultiplier = d === 0 || d === 6 ? 1.25 : 1.0;
    return {
      date,
      predictedOrders: Math.round(trailingAverageOrders * weekendMultiplier),
      predictedSalesCents: Math.round(trailingAverageSalesCents * weekendMultiplier),
      confidence: days.length >= 14 ? 0.75 : 0.5
    };
  });

  return NextResponse.json({
    horizonDays,
    baseline: {
      trailingAverageOrders: Math.round(trailingAverageOrders * 10) / 10,
      trailingAverageSalesCents: Math.round(trailingAverageSalesCents)
    },
    forecast
  });
}
