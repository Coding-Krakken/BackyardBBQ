import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    basePriceCents?: number;
    isAvailable?: boolean;
  };

  const updated = await prisma.menuItem.update({
    where: { id },
    data: body
  });

  return NextResponse.json({ data: updated });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const body = (await request.json()) as { isAvailable?: boolean };

  const updated = await prisma.menuItem.update({
    where: { id },
    data: { isAvailable: body.isAvailable }
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;

  // Soft delete by setting isAvailable to false
  const updated = await prisma.menuItem.update({
    where: { id },
    data: { isAvailable: false }
  });

  return NextResponse.json({ data: updated });
}
