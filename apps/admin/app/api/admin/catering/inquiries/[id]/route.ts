import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["pending", "contacted", "booked", "declined", "cancelled"]),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const inquiry = await prisma.cateringInquiry.findUnique({
    where: { id: params.id },
  });

  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  return NextResponse.json({ inquiry });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const inquiry = await prisma.cateringInquiry.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ inquiry });
}
