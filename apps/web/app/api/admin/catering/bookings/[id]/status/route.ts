import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../../../lib/auth";
import { prisma } from "../../../../../../../lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) return null;
  return session;
}

const validStatuses = ["pending_approval", "approved", "declined", "cancelled"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = params;
  const body = (await request.json()) as { status?: string };
  const status = body.status;

  if (!status || !validStatuses.includes(status as typeof validStatuses[number])) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  const booking = await prisma.cateringBooking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ message: "Booking not found" }, { status: 404 });

  const updated = await prisma.cateringBooking.update({
    where: { id },
    data: { status: status as typeof validStatuses[number] }
  });

  return NextResponse.json({ data: updated });
}
