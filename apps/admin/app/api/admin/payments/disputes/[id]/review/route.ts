import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const event = await prisma.integrationEvent.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ message: "Dispute event not found" }, { status: 404 });

  const updated = await prisma.integrationEvent.update({
    where: { id },
    data: { status: "reviewed" }
  });

  return NextResponse.json({ data: updated });
}
