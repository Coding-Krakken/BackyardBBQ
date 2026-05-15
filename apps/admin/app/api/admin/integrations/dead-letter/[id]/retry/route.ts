import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const event = await prisma.integrationEvent.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ message: "Event not found" }, { status: 404 });

  const prevPayload = event.payload as Record<string, unknown>;
  const updated = await prisma.integrationEvent.update({
    where: { id },
    data: {
      status: "pending",
      payload: { ...prevPayload, retriedAt: new Date().toISOString() }
    }
  });

  return NextResponse.json({ data: updated });
}
