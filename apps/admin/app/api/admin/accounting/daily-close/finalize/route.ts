import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(['owner']); // Only owner can finalize
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as { date?: string };
  const date = body.date ?? new Date().toISOString().slice(0, 10);

  // Record finalization as an IntegrationEvent
  await prisma.integrationEvent.create({
    data: {
      channel: "accounting",
      eventType: "daily_close",
      status: "finalized",
      payload: { date, finalizedAt: new Date().toISOString(), finalizedBy: auth.session.user?.email ?? "admin" }
    }
  });

  return NextResponse.json({ message: "Daily close finalized.", date });
}
