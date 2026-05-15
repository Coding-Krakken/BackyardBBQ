import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

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

  // Disputes are stored as IntegrationEvents where eventType contains "dispute"
  const events = await prisma.integrationEvent.findMany({
    where: { eventType: { contains: "dispute" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  const data = events.map((e) => {
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
