import { NextRequest, NextResponse } from "next/server";
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
    orderBy: [{ locationId: 'asc' }, { name: 'asc' }]
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
    isAvailable?: boolean;
  };

  const item = await prisma.menuItem.create({
    data: {
      locationId: body.locationId,
      name: body.name,
      description: body.description ?? null,
      basePriceCents: body.basePriceCents,
      isAvailable: body.isAvailable ?? true
    }
  });

  return NextResponse.json({ data: item }, { status: 201 });
}
