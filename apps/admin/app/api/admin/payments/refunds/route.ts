import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider, unsupportedProviderMessage } from "@/lib/payment-provider";

const REFUND_EVENT_TYPES = new Set([
  "admin.refund.issued",
  "admin.refund.manual_requested",
  "admin.payment_refund_created",
  "admin.payment_refund_requested",
]);

function getRefundAmountCents(payload: Record<string, unknown>): number {
  const candidateKeys = ["requestedAmountCents", "amountCents", "refundAmountCents"] as const;

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

function parseRequestedAmountCents(value: unknown): number | null {
  if (typeof value === "number") {
    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    return null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
    return null;
  }

  if (typeof value === "undefined") {
    return null;
  }

  return null;
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

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    paymentIntentId?: string;
    amountCents?: number;
    reason?: string;
  };
  const { paymentIntentId } = body;
  if (!paymentIntentId) {
    return NextResponse.json({ message: "paymentIntentId is required" }, { status: 400 });
  }

  const requestedAmountCents = parseRequestedAmountCents(body.amountCents);
  if (typeof body.amountCents !== "undefined" && requestedAmountCents === null) {
    return NextResponse.json({ message: "amountCents must be a positive integer" }, { status: 400 });
  }

  const provider = getPaymentProvider();

  const eposPaymentReferences = provider === "epos"
    ? Array.from(
        new Set(
          paymentIntentId.startsWith("epos_txn_")
            ? [paymentIntentId, paymentIntentId.slice("epos_txn_".length)]
            : [paymentIntentId, `epos_txn_${paymentIntentId}`]
        )
      )
    : [paymentIntentId];
  const eposPaymentReferenceCandidates = new Set(eposPaymentReferences.map((reference) => reference.trim()));

  const payment = provider === "epos"
    ? await prisma.paymentTransaction.findFirst({
        where: {
          stripePaymentIntentId: {
            in: eposPaymentReferences,
          },
        },
      })
    : await prisma.paymentTransaction.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      });

  if (!payment) {
    return NextResponse.json({ message: "Payment not found" }, { status: 404 });
  }

  if (provider === "epos") {
    const candidateRefundEvents = await prisma.integrationEvent.findMany({
      where: {
        channel: "admin",
        eventType: { in: Array.from(REFUND_EVENT_TYPES) },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        eventType: true,
        payload: true,
      },
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
      const matchesPaymentIntent =
        typeof payloadPaymentReference === "string" &&
        eposPaymentReferenceCandidates.has(payloadPaymentReference.trim());
      if (!matchesTransaction && !matchesPaymentIntent) {
        return total;
      }

      return total + getRefundAmountCents(payload);
    }, 0);

    const maxRefundableCents = Math.max(0, payment.amountCents - alreadyRequestedCents);
    if (maxRefundableCents <= 0) {
      return NextResponse.json({ message: "No refundable balance remains" }, { status: 400 });
    }

    const amountToRefundCents = requestedAmountCents ?? maxRefundableCents;

    if (amountToRefundCents > maxRefundableCents) {
      return NextResponse.json({ message: "Refund amount exceeds remaining refundable balance" }, { status: 400 });
    }

    const manualRequest = await prisma.integrationEvent.create({
      data: {
        orderId: payment.orderId,
        channel: "admin",
        eventType: "admin.payment_refund_requested",
        status: "pending_manual",
        payload: {
          provider,
          transactionId: payment.id,
          paymentIntentId,
          eposTransactionId: payment.stripePaymentIntentId.startsWith("epos_txn_")
            ? payment.stripePaymentIntentId.slice("epos_txn_".length)
            : payment.stripePaymentIntentId,
          paymentAmountCents: payment.amountCents,
          previouslyRequestedCents: alreadyRequestedCents,
          requestedAmountCents: amountToRefundCents,
          reason: typeof body.reason === "string" ? body.reason : "requested_by_customer",
          requestedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json(
      {
        requestId: manualRequest.id,
        status: "pending_manual",
        paymentIntentId,
        amountCents: amountToRefundCents,
        message: "EPOS refund request has been queued for manual processing.",
      },
      { status: 202 }
    );
  }

  return NextResponse.json(
    { message: unsupportedProviderMessage("/api/admin/payments/refunds") },
    { status: 501 }
  );
}
