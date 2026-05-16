import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
    imageUrl?: string;
    category?: string;
    sortOrder?: number;
    customizations?: unknown;
    notes?: string;
    isFeatured?: boolean;
    isAvailable?: boolean;
  };

  const { customizations, ...rest } = body;
  const updated = await prisma.menuItem.update({
    where: { id },
    data: {
      ...rest,
      ...(customizations !== undefined && {
        customizations: customizations as Prisma.InputJsonValue,
      }),
    },
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
  const body = (await request.json()) as { isAvailable?: boolean; sortOrder?: number };

  const data: { isAvailable?: boolean; sortOrder?: number } = {};
  if (body.isAvailable !== undefined) data.isAvailable = body.isAvailable;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const updated = await prisma.menuItem.update({
    where: { id },
    data
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
