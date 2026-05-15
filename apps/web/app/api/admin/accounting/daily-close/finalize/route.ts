import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) return null;
  return session;
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { date?: string };
  const date = body.date ?? new Date().toISOString().slice(0, 10);

  // Record finalization as an IntegrationEvent
  await prisma.integrationEvent.create({
    data: {
      channel: "accounting",
      eventType: "daily_close",
      status: "finalized",
      payload: { date, finalizedAt: new Date().toISOString(), finalizedBy: session.user?.email ?? "admin" }
    }
  });

  return NextResponse.json({ message: "Daily close finalized.", date });
}
