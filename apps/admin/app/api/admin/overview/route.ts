import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { PAYMENT_REVENUE_STATUSES } from "@bbq/domain";
import type { PaymentStatus } from "@prisma/client";

export async function GET() {
  const auth = await requireAdmin(['owner', 'admin', 'manager', 'staff', 'accounting']);
  if (auth instanceof NextResponse) return auth;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Use PaymentTransaction as the single source of truth for revenue
  const [pendingOrders, activeBookings, salesAgg] = await Promise.all([
    prisma.order.count({ where: { status: "pending" } }),
    prisma.cateringBooking.count({ where: { status: { in: ["pending_approval", "approved"] } } }),
    prisma.paymentTransaction.aggregate({
      _sum: { amountCents: true },
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: { in: PAYMENT_REVENUE_STATUSES as unknown as PaymentStatus[] },
      },
    }),
  ]);

  return NextResponse.json({
    totals: {
      pendingOrders,
      activeBookings,
      grossSalesCentsToday: salesAgg._sum.amountCents ?? 0
    }
  });
}
