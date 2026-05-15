import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where = status ? { status: status as any } : {};

  const referrals = await prisma.referral.findMany({
    where,
    include: {
      referrer: { select: { firstName: true, lastName: true, email: true } },
      referee: { select: { firstName: true, lastName: true, email: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });

  return NextResponse.json({ data: referrals });
}
