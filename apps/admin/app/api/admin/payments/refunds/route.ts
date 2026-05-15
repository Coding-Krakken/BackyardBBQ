import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

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
