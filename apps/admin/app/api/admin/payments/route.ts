import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const EPOS_TXN_PREFIX = "epos_txn_";

function inferProvider(paymentIntentId: string | null, payloadProvider: unknown): "stripe" | "epos" {
  if (typeof payloadProvider === "string") {
    const normalized = payloadProvider.trim().toLowerCase();
    if (normalized === "epos") {
      return "epos";
    }
    if (normalized === "stripe") {
      return "stripe";
    }
  }

  if (paymentIntentId?.startsWith(EPOS_TXN_PREFIX)) {
    return "epos";
  }

  return "epos";
}

function parseAmountCents(payload: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }
  }

  return 0;
}

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
  const paymentIdSet = new Set(paymentIds);
  const refundEvents = paymentIds.length
    ? await prisma.integrationEvent.findMany({
        where: {
          channel: 'admin',
          eventType: {
            in: [
              'admin.refund.issued',
              'admin.refund.manual_requested',
              'admin.payment_refund_created',
              'admin.payment_refund_requested',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          eventType: true,
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
      provider: "stripe" | "epos";
    }>
  >();

  const paymentProviderById = new Map<string, "stripe" | "epos">();

  for (const event of refundEvents) {
    const payload = event.payload as Record<string, unknown>;
    const transactionId = typeof payload.transactionId === 'string' ? payload.transactionId : null;
    if (!transactionId || !paymentIdSet.has(transactionId)) {
      continue;
    }

    const amountCents = parseAmountCents(payload, ['requestedAmountCents', 'amountCents', 'refundAmountCents']);
    const totalRefundedCents = parseAmountCents(payload, ['totalRefundedCents']) || amountCents;
    const reason = typeof payload.reason === 'string' ? payload.reason : 'requested_by_customer';
    const refundedAt =
      typeof payload.refundedAt === 'string' ? payload.refundedAt : event.createdAt.toISOString();
    const stripeRefundId = typeof payload.stripeRefundId === 'string' ? payload.stripeRefundId : null;
    const paymentIntentId = typeof payload.paymentIntentId === 'string' ? payload.paymentIntentId : null;
    const provider = inferProvider(paymentIntentId, payload.provider);

    const existing = refundHistoryByPaymentId.get(transactionId) ?? [];
    existing.push({
      amountCents,
      totalRefundedCents,
      reason,
      refundedAt,
      stripeRefundId,
      provider,
    });
    refundHistoryByPaymentId.set(transactionId, existing);

    const knownProvider = paymentProviderById.get(transactionId);
    if (!knownProvider || provider === 'epos') {
      paymentProviderById.set(transactionId, provider);
    }
  }

  const data = payments.map((payment) => ({
    ...payment,
    paymentType: payment.paymentType || "order",
    provider: paymentProviderById.get(payment.id) ?? inferProvider(payment.stripePaymentIntentId, null),
    refundHistory: refundHistoryByPaymentId.get(payment.id) ?? [],
  }));

  return NextResponse.json({ data });
}
