import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'manager', 'staff']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const bookings = await prisma.cateringBooking.findMany({
    include: { location: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  return NextResponse.json({ data: bookings });
}
