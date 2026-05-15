import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'accounting']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  // Disputes are stored as IntegrationEvents where eventType contains "dispute"
  const events = await prisma.integrationEvent.findMany({
    where: { eventType: { contains: "dispute" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  const data = events.map((e: typeof events[number]) => {
    const p = e.payload as Record<string, unknown>;
    return {
      id: e.id,
      disputeId: (p.disputeId as string | undefined) ?? e.id,
      paymentIntentId: (p.paymentIntentId as string | undefined) ?? "",
      amountCents: (p.amountCents as number | undefined) ?? 0,
      reason: (p.reason as string | undefined) ?? "unknown",
      status: e.status,
      createdAt: e.createdAt.toISOString()
    };
  });

  return NextResponse.json({ data });
}
