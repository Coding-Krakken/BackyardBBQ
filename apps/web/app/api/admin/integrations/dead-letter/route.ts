import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) return null;
  return session;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const events = await prisma.integrationEvent.findMany({
    where: { status: { in: ["failed", "dead_letter"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  const data = events.map((e) => {
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
