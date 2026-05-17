import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");
  const eventType = searchParams.get("eventType");
  const correlationId = searchParams.get("correlationId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.IntegrationEventWhereInput = {
    status: { in: ["failed", "dead_letter"] }
  };

  if (channel && ["doordash", "ubereats", "grubhub", "stripe", "internal"].includes(channel)) {
    where.channel = channel;
  }

  if (status && ["failed", "dead_letter"].includes(status)) {
    where.status = status;
  }

  if (eventType && eventType.trim().length > 0) {
    where.eventType = { contains: eventType.trim() };
  }

  if (correlationId && correlationId.trim().length > 0) {
    where.payload = {
      path: ["correlationId"],
      equals: correlationId.trim()
    };
  }

  const createdAt: Prisma.DateTimeFilter = {};
  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      createdAt.gte = fromDate;
    }
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      createdAt.lte = toDate;
    }
  }
  if (createdAt.gte || createdAt.lte) {
    where.createdAt = createdAt;
  }

  const events = await prisma.integrationEvent.findMany({
    where,
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
        correlationId: (p.correlationId as string | undefined),
        retriedAt: (p.retriedAt as string | undefined)
      },
      createdAt: e.createdAt.toISOString()
    };
  });

  return NextResponse.json({ data });
}
