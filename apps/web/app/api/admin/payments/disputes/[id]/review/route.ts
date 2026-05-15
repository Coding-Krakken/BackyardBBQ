import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) return null;
  return session;
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = params;
  const event = await prisma.integrationEvent.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ message: "Dispute event not found" }, { status: 404 });

  const updated = await prisma.integrationEvent.update({
    where: { id },
    data: { status: "reviewed" }
  });

  return NextResponse.json({ data: updated });
}
