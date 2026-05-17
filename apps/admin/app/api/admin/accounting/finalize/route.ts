import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as { from?: string; to?: string };
  const from = body.from ?? new Date().toISOString().slice(0, 10);
  const to = body.to ?? from;

  await prisma.integrationEvent.create({
    data: {
      channel: "accounting",
      eventType: "daily_close",
      status: "finalized",
      payload: {
        from,
        to,
        finalizedAt: new Date().toISOString(),
        finalizedBy: auth.session.user?.email ?? "owner"
      }
    }
  });

  return NextResponse.json({ message: "Accounting period finalized.", from, to });
}
