import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import {
  PAYMENT_REVENUE_STATUSES,
  PAYMENT_REFUND_STATUSES,
} from "@bbq/domain";
import type { PaymentStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "14"), 90);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Use PaymentTransaction for revenue metrics (single source of truth)
  // Keep Order data for item breakdown and order counts
  const [payments, refunds, orders] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: PAYMENT_REVENUE_STATUSES as unknown as PaymentStatus[] },
      },
      select: {
        amountCents: true,
        createdAt: true,
        order: { select: { source: true } },
      },
    }),
    prisma.paymentTransaction.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: PAYMENT_REFUND_STATUSES as unknown as PaymentStatus[] },
      },
      select: { amountCents: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { notIn: ["cancelled"] } },
      select: {
        id: true, source: true, totalCents: true, createdAt: true,
        items: { select: { menuItemName: true, quantity: true, unitPriceCents: true } }
      }
    }),
  ]);

  // Calculate revenue from payments (accurate financial data)
  const grossSalesCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const refundsCents = refunds.reduce((sum, p) => sum + p.amountCents, 0);
  const netSalesCents = Math.max(0, grossSalesCents - refundsCents);

  const totals = {
    orders: orders.length,
    grossSalesCents,
    refundsCents,
    netSalesCents,
    averageOrderValueCents: orders.length > 0 ? Math.round(grossSalesCents / orders.length) : 0,
  };

  // Daily revenue from PaymentTransaction (accurate)
  const dailyMap: Record<string, { orders: number; grossSalesCents: number }> = {};
  
  for (const payment of payments) {
    const day = payment.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { orders: 0, grossSalesCents: 0 };
    const dday = dailyMap[day]!;
    dday.grossSalesCents += payment.amountCents;
  }

  // Add order counts to daily map
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { orders: 0, grossSalesCents: 0 };
    dailyMap[day]!.orders += 1;
  }

  // Source breakdown from PaymentTransaction (accurate revenue)
  const sourceMap: Record<string, { orders: number; grossSalesCents: number }> = {};
  for (const payment of payments) {
    const source = payment.order?.source ?? "direct";
    if (!sourceMap[source]) sourceMap[source] = { orders: 0, grossSalesCents: 0 };
    sourceMap[source]!.grossSalesCents += payment.amountCents;
  }
  // Add order counts
  for (const o of orders) {
    if (!sourceMap[o.source]) sourceMap[o.source] = { orders: 0, grossSalesCents: 0 };
    sourceMap[o.source]!.orders += 1;
  }

  // Top items from Order data (only source of item details)
  const itemMap: Record<string, { quantity: number; revenueCents: number }> = {};
  for (const o of orders) {
    for (const item of o.items) {
      if (!itemMap[item.menuItemName]) itemMap[item.menuItemName] = { quantity: 0, revenueCents: 0 };
      const di = itemMap[item.menuItemName]!;
      di.quantity += item.quantity;
      di.revenueCents += item.quantity * item.unitPriceCents;
    }
  }

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
