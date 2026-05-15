import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner']); // Only owner can update locations
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const body = (await request.json()) as {
    name?: string;
    type?: 'truck' | 'brick_and_mortar';
    timezone?: string;
    maxCateringCap?: number;
    isActive?: boolean;
  };

  const updated = await prisma.location.update({
    where: { id },
    data: body
  });

  return NextResponse.json({ data: updated });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const body = (await request.json()) as { isActive?: boolean };

  const updated = await prisma.location.update({
    where: { id },
    data: { isActive: body.isActive }
  });

  return NextResponse.json({ data: updated });
}
