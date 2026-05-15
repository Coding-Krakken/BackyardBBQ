import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const events = await prisma.integrationEvent.findMany({
    where: { status: { in: ["failed", "dead_letter"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  const data = events.map((e: typeof events[number]) => {
    const p = e.payload as Record<string, unknown>;
    return {
      id: e.id,
      channel: e.channel,
      eventType: e.eventType,
      status: e.status,
      payload: {
        reason: (p.reason as string | undefined),
        orderExternalId: (p.orderExternalId as string | undefined),
        retriedAt: (p.retriedAt as string | undefined)
      },
      createdAt: e.createdAt.toISOString()
    };
  });

  return NextResponse.json({ data });
}
