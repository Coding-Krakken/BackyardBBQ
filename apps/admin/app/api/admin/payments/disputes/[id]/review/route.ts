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
  if (!event) return NextResponse.json({ message: "Dispute event not found" }, { status: 404 });

  if (!event.eventType.includes("dispute")) {
    return NextResponse.json({ message: "Event is not a dispute" }, { status: 400 });
  }

  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : {};
  const reviewedAt = new Date().toISOString();

  const updated = await prisma.integrationEvent.update({
    where: { id },
    data: {
      status: "reviewed",
      payload: {
        ...payload,
        disputeStatus: "reviewed",
        reviewedAt,
      },
    }
  });

  return NextResponse.json({ data: updated });
}
