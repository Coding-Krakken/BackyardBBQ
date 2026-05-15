import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where = q ? {
    OR: [
      { email: { contains: q, mode: 'insensitive' as const } },
      { firstName: { contains: q, mode: 'insensitive' as const } },
      { lastName: { contains: q, mode: 'insensitive' as const } },
    ]
  } : {};

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      createdAt: true,
      _count: {
        select: { orders: true, bookings: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });

  const data = customers.map((c: typeof customers[number]) => ({
    id: c.id,
    email: c.email,
    name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
    phone: c.phone,
    role: c.role,
    ordersCount: c._count.orders,
    bookingsCount: c._count.bookings,
    memberSince: c.createdAt.toISOString()
  }));

  return NextResponse.json({ data });
}
