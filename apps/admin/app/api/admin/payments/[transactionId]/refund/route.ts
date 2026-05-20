import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider, unsupportedProviderMessage } from "@/lib/payment-provider";

const refundSchema = z.object({
  amountCents: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return Number(value);
      }

      return value;
    }, z.number().int().min(1))
    .optional(),
  reason: z.string().trim().min(1).max(200).default("requested_by_customer"),
});

const REFUND_EVENT_TYPES = new Set([
  "admin.refund.issued",
  "admin.refund.manual_requested",
  "admin.payment_refund_created",
  "admin.payment_refund_requested"
]);

function getRefundAmountCents(payload: Record<string, unknown>): number {
  const candidateKeys = [
    "requestedAmountCents",
    "amountCents",
    "refundAmountCents"
  ] as const;

  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
      }
    }
  }

  return 0;
}

function getEposTransactionId(paymentReference: string): string | null {
  const trimmed = paymentReference.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("epos_txn_")) {
    const unprefixed = trimmed.slice("epos_txn_".length).trim();
    return unprefixed || null;
  }

  return trimmed;
}

function getEposPaymentReferenceCandidates(paymentReference: string): Set<string> {
  const trimmed = paymentReference.trim();
  if (!trimmed) {
    return new Set();
  }

  if (trimmed.startsWith("epos_txn_")) {
    const raw = trimmed.slice("epos_txn_".length).trim();
    return new Set(raw ? [trimmed, raw] : [trimmed]);
  }

  return new Set([trimmed, `epos_txn_${trimmed}`]);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const provider = getPaymentProvider();

  const parsed = refundSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid refund payload" }, { status: 400 });
  }

  const { transactionId } = params;
  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      orderId: true,
      amountCents: true,
      status: true,
      stripePaymentIntentId: true,
    },
  });

  if (!payment) {
    return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
  }

  if (!["succeeded", "completed", "partially_refunded"].includes(payment.status)) {
    return NextResponse.json({ message: "Transaction is not refundable" }, { status: 400 });
  }

  if (payment.status === "refunded") {
    return NextResponse.json({ message: "Transaction already fully refunded" }, { status: 400 });
  }

  if (!payment.stripePaymentIntentId) {
    return NextResponse.json({ message: "Transaction has no payment transaction reference" }, { status: 400 });
  }

  if (provider === "epos") {
    const paymentReferenceCandidates = getEposPaymentReferenceCandidates(payment.stripePaymentIntentId);

    const candidateRefundEvents = await prisma.integrationEvent.findMany({
      where: {
        channel: "admin",
        eventType: { in: Array.from(REFUND_EVENT_TYPES) }
      },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        eventType: true,
        payload: true
      }
    });

    const alreadyRequestedCents = candidateRefundEvents.reduce((total, event) => {
      if (!REFUND_EVENT_TYPES.has(event.eventType)) {
        return total;
      }

      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as Record<string, unknown>)
          : {};

      const payloadPaymentReference =
        typeof payload.paymentIntentId === "string"
          ? payload.paymentIntentId
          : typeof payload.stripePaymentIntentId === "string"
            ? payload.stripePaymentIntentId
            : null;

      const matchesTransaction = payload.transactionId === payment.id;
      const matchesPaymentReference =
        typeof payloadPaymentReference === "string" &&
        paymentReferenceCandidates.has(payloadPaymentReference.trim());

      if (!matchesTransaction && !matchesPaymentReference) {
        return total;
      }

      return total + getRefundAmountCents(payload);
    }, 0);

    const maxRefundableCents = Math.max(0, payment.amountCents - alreadyRequestedCents);
    if (maxRefundableCents <= 0) {
      return NextResponse.json({ message: "No refundable balance remains" }, { status: 400 });
    }

    const requestedAmountCents = parsed.data.amountCents ?? maxRefundableCents;
    if (requestedAmountCents > maxRefundableCents) {
      return NextResponse.json({ message: "Refund amount exceeds transaction amount" }, { status: 400 });
    }

    const manualRequest = await prisma.integrationEvent.create({
      data: {
        orderId: payment.orderId,
        channel: "admin",
        eventType: "admin.refund.manual_requested",
        status: "pending_manual",
        payload: {
          provider,
          transactionId: payment.id,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          eposTransactionId: getEposTransactionId(payment.stripePaymentIntentId),
          paymentAmountCents: payment.amountCents,
          previouslyRequestedCents: alreadyRequestedCents,
          requestedAmountCents,
          reason: parsed.data.reason,
          requestedAt: new Date().toISOString(),
          instructions:
            "Complete refund in EPOS Back Office using RefundReason and Transaction records, then reconcile this request.",
        },
      },
    });

    return NextResponse.json(
      {
        data: payment,
        refund: {
          amountCents: requestedAmountCents,
          reason: parsed.data.reason,
          status: "pending_manual",
          requestId: manualRequest.id,
          provider,
        },
        message:
          "EPOS refund request has been queued for manual processing and reconciliation.",
      },
      { status: 202 }
    );
  }

  return NextResponse.json(
    { message: unsupportedProviderMessage("/api/admin/payments/[transactionId]/refund") },
    { status: 501 }
  );
}
