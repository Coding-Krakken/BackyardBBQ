import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        select: { id: true, source: true, status: true, totalCents: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      bookings: {
        select: { id: true, eventDate: true, partySize: true, status: true, packageName: true },
        orderBy: { eventDate: 'desc' },
        take: 10
      },
      referralsSent: {
        select: { refereeEmail: true, status: true, rewardCents: true, claimedAt: true }
      }
    }
  });

  if (!customer) {
    return NextResponse.json({ message: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ data: customer });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const body = (await request.json()) as { role?: string };

  const updated = await prisma.customer.update({
    where: { id },
    data: { role: body.role as any }
  });

  return NextResponse.json({ data: updated });
}
