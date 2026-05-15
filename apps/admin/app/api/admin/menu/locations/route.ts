import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin(['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const locations = await prisma.location.findMany({
    orderBy: { name: 'asc' }
  });

  return NextResponse.json({ data: locations });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(['owner']); // Only owner can create locations
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    name: string;
    type: 'truck' | 'brick_and_mortar';
    timezone?: string;
    maxCateringCap?: number;
    isActive?: boolean;
  };

  const location = await prisma.location.create({
    data: {
      name: body.name,
      type: body.type,
      timezone: body.timezone ?? 'America/New_York',
      maxCateringCap: body.maxCateringCap ?? 100,
      isActive: body.isActive ?? true
    }
  });

  return NextResponse.json({ data: location }, { status: 201 });
}
