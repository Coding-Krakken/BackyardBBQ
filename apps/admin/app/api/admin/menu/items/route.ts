import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");

  const where = locationId ? { locationId } : {};

  const items = await prisma.menuItem.findMany({
    where,
    include: {
      location: { select: { name: true } }
    },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
  });

  return NextResponse.json({ data: items });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    locationId: string;
    name: string;
    description?: string;
    basePriceCents: number;
    imageUrl?: string;
    category: string;
    sortOrder?: number;
    customizations?: unknown;
    notes?: string;
    isFeatured?: boolean;
    isAvailable?: boolean;
  };

  const item = await prisma.menuItem.create({
    data: {
      locationId: body.locationId,
      name: body.name,
      description: body.description ?? null,
      basePriceCents: body.basePriceCents,
      imageUrl: body.imageUrl ?? null,
      category: body.category,
      sortOrder: body.sortOrder ?? 0,
      customizations: body.customizations != null
        ? (body.customizations as Prisma.InputJsonValue)
        : Prisma.DbNull,
      notes: body.notes ?? null,
      isFeatured: body.isFeatured ?? false,
      isAvailable: body.isAvailable ?? true
    }
  });

  return NextResponse.json({ data: item }, { status: 201 });
}
