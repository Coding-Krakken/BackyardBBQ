import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const STRIPE_REFUND_REASONS = new Set([
  "duplicate",
  "fraudulent",
  "requested_by_customer"
]);

function toStripeRefundReason(
  reason: string
): "duplicate" | "fraudulent" | "requested_by_customer" {
  if (STRIPE_REFUND_REASONS.has(reason)) {
    return reason as "duplicate" | "fraudulent" | "requested_by_customer";
  }

  return "requested_by_customer";
}

const refundSchema = z.object({
  amountCents: z.number().int().min(1).optional(),
  reason: z.string().trim().min(1).max(200).default("requested_by_customer"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  if (!stripe) {
    return NextResponse.json({ message: "Stripe is not configured" }, { status: 500 });
  }

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
    return NextResponse.json({ message: "Transaction has no Stripe payment intent" }, { status: 400 });
  }

  let maxRefundableCents = payment.amountCents;
  let alreadyRefundedCents = 0;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId, {
      expand: ["latest_charge"]
    });

    if (paymentIntent.latest_charge && typeof paymentIntent.latest_charge !== "string") {
      alreadyRefundedCents = paymentIntent.latest_charge.amount_refunded ?? 0;
      maxRefundableCents = Math.max(
        0,
        (paymentIntent.latest_charge.amount ?? payment.amountCents) - alreadyRefundedCents
      );
    } else {
      const refunds = await stripe.refunds.list({
        payment_intent: payment.stripePaymentIntentId,
        limit: 100
      });

      alreadyRefundedCents = refunds.data.reduce((sum, refund) => sum + (refund.amount ?? 0), 0);
      maxRefundableCents = Math.max(0, payment.amountCents - alreadyRefundedCents);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify Stripe refund balance";
    return NextResponse.json({ message }, { status: 502 });
  }

  if (maxRefundableCents <= 0) {
    return NextResponse.json({ message: "No refundable balance remains" }, { status: 400 });
  }

  const requestedAmountCents = parsed.data.amountCents ?? maxRefundableCents;
  if (requestedAmountCents > maxRefundableCents) {
    return NextResponse.json({ message: "Refund amount exceeds transaction amount" }, { status: 400 });
  }

  let stripeRefundId: string;

  try {
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      amount: requestedAmountCents,
      reason: toStripeRefundReason(parsed.data.reason),
      metadata: {
        adminRefundReason: parsed.data.reason,
        paymentTransactionId: payment.id
      }
    });

    stripeRefundId = refund.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe refund failed";
    return NextResponse.json({ message }, { status: 502 });
  }

  const totalRefundedCents = alreadyRefundedCents + requestedAmountCents;
  const nextStatus = totalRefundedCents >= payment.amountCents ? "refunded" : "partially_refunded";

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
      },
    });

    await tx.integrationEvent.create({
      data: {
        orderId: payment.orderId,
        channel: "admin",
        eventType: "admin.refund.issued",
        status: "recorded",
        payload: {
          transactionId: payment.id,
          paymentIntentId: payment.stripePaymentIntentId,
          stripeRefundId,
          previouslyRefundedCents: alreadyRefundedCents,
          requestedAmountCents,
          totalRefundedCents,
          reason: parsed.data.reason,
          refundedAt: new Date().toISOString(),
          mode: nextStatus,
        },
      },
    });

    return updatedPayment;
  });

  return NextResponse.json({
    data: updated,
    refund: {
      amountCents: requestedAmountCents,
      reason: parsed.data.reason,
      status: nextStatus,
    },
  });
}
