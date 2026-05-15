import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin(['owner', 'admin', 'manager', 'staff', 'accounting']);
  if (auth instanceof NextResponse) return auth;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [pendingOrders, activeBookings, salesAgg] = await Promise.all([
    prisma.order.count({ where: { status: "pending" } }),
    prisma.cateringBooking.count({ where: { status: { in: ["pending_approval", "approved"] } } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { createdAt: { gte: today, lt: tomorrow }, status: { notIn: ["cancelled"] } }
    })
  ]);

  return NextResponse.json({
    totals: {
      pendingOrders,
      activeBookings,
      grossSalesCentsToday: salesAgg._sum.totalCents ?? 0
    }
  });
}
