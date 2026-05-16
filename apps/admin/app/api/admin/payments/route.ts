import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'accounting']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const payments = await prisma.paymentTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  const paymentIds = payments.map((payment) => payment.id);
  const refundEvents = paymentIds.length
    ? await prisma.integrationEvent.findMany({
        where: {
          channel: 'admin',
          eventType: 'admin.refund.issued',
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          payload: true,
          createdAt: true,
        },
      })
    : [];

  const refundHistoryByPaymentId = new Map<
    string,
    Array<{
      amountCents: number;
      totalRefundedCents: number;
      reason: string;
      refundedAt: string;
      stripeRefundId: string | null;
    }>
  >();

  for (const event of refundEvents) {
    const payload = event.payload as Record<string, unknown>;
    const transactionId = typeof payload.transactionId === 'string' ? payload.transactionId : null;
    if (!transactionId || !paymentIds.includes(transactionId)) {
      continue;
    }

    const amountCents = typeof payload.requestedAmountCents === 'number' ? payload.requestedAmountCents : 0;
    const totalRefundedCents =
      typeof payload.totalRefundedCents === 'number' ? payload.totalRefundedCents : amountCents;
    const reason = typeof payload.reason === 'string' ? payload.reason : 'requested_by_customer';
    const refundedAt =
      typeof payload.refundedAt === 'string' ? payload.refundedAt : event.createdAt.toISOString();
    const stripeRefundId = typeof payload.stripeRefundId === 'string' ? payload.stripeRefundId : null;

    const existing = refundHistoryByPaymentId.get(transactionId) ?? [];
    existing.push({
      amountCents,
      totalRefundedCents,
      reason,
      refundedAt,
      stripeRefundId,
    });
    refundHistoryByPaymentId.set(transactionId, existing);
  }

  const data = payments.map((payment) => ({
    ...payment,
    paymentType: payment.paymentType || "order",
    provider: "stripe",
    refundHistory: refundHistoryByPaymentId.get(payment.id) ?? [],
  }));

  return NextResponse.json({ data });
}
