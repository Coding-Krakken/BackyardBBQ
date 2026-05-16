import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const event = await prisma.integrationEvent.findUnique({
    where: { id: params.id },
  });

  if (!event || !event.eventType.includes("dispute")) {
    return NextResponse.json({ message: "Dispute event not found" }, { status: 404 });
  }

  const payload = (event.payload ?? {}) as Record<string, unknown>;

  const data = {
    id: event.id,
    eventType: event.eventType,
    status: event.status,
    createdAt: event.createdAt,
    disputeId: typeof payload.disputeId === "string" ? payload.disputeId : null,
    paymentIntentId:
      typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null,
    amountCents: typeof payload.amountCents === "number" ? payload.amountCents : 0,
    currency: typeof payload.currency === "string" ? payload.currency : "usd",
    reason: typeof payload.reason === "string" ? payload.reason : "unknown",
    disputeStatus:
      typeof payload.disputeStatus === "string" ? payload.disputeStatus : event.status,
    evidence:
      payload.evidence && typeof payload.evidence === "object"
        ? payload.evidence
        : null,
    dueBy:
      typeof payload.evidenceDueBy === "number"
        ? new Date(payload.evidenceDueBy * 1000).toISOString()
        : null,
    updatedAt:
      typeof payload.updatedAt === "number"
        ? new Date(payload.updatedAt * 1000).toISOString()
        : null,
  };

  return NextResponse.json({ data });
}
