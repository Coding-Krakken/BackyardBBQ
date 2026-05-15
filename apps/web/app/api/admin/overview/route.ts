import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

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
