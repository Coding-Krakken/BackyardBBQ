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

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { paymentIntentId?: string };
  const { paymentIntentId } = body;
  if (!paymentIntentId) {
    return NextResponse.json({ message: "paymentIntentId is required" }, { status: 400 });
  }

  const payment = await prisma.paymentTransaction.findUnique({
    where: { stripePaymentIntentId: paymentIntentId }
  });
  if (!payment) {
    return NextResponse.json({ message: "Payment not found" }, { status: 404 });
  }

  const updated = await prisma.paymentTransaction.update({
    where: { stripePaymentIntentId: paymentIntentId },
    data: { status: "refunded" }
  });

  return NextResponse.json({ data: updated });
}
