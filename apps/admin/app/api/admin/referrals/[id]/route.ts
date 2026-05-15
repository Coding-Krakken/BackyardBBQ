import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const body = (await request.json()) as { status: 'rewarded' | 'expired' };

  const data: any = { status: body.status };
  if (body.status === 'rewarded') {
    data.rewardClaimed = true;
    data.claimedAt = new Date();
  }

  const updated = await prisma.referral.update({
    where: { id },
    data
  });

  return NextResponse.json({ data: updated });
}
