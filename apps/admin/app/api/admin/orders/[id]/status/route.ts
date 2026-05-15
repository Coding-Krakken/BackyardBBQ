import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const validStatuses = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin', 'manager', 'staff']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const body = (await request.json()) as { status?: string };
  const status = body.status;

  if (!status || !validStatuses.includes(status as typeof validStatuses[number])) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 });

  const updated = await prisma.order.update({
    where: { id },
    data: { status: status as typeof validStatuses[number] }
  });

  return NextResponse.json({ data: updated });
}
