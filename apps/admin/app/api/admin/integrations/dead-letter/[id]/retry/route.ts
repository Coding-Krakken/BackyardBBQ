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
  const event = await prisma.integrationEvent.findUnique({
    where: { id },
    select: {
      id: true,
      channel: true,
      status: true,
      payload: true
    }
  });
  if (!event) return NextResponse.json({ message: "Event not found" }, { status: 404 });

  if (!['doordash', 'ubereats', 'grubhub'].includes(event.channel)) {
    return NextResponse.json(
      { message: "Only delivery integration events can be retried from this endpoint" },
      { status: 409 }
    );
  }

  if (!['dead_letter', 'retry_failed'].includes(event.status)) {
    return NextResponse.json(
      { message: `Cannot retry event with status ${event.status}` },
      { status: 409 }
    );
  }

  const prevPayload = event.payload as Record<string, unknown>;
  const previousAttempts = typeof prevPayload.attempts === "number" ? prevPayload.attempts : 0;
  const updated = await prisma.integrationEvent.update({
    where: { id },
    data: {
      status: "queued",
      payload: {
        ...prevPayload,
        attempts: previousAttempts + 1,
        retriedAt: new Date().toISOString(),
        retryRequestedByRole: auth.role
      }
    }
  });

  return NextResponse.json({ data: updated });
}
