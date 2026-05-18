import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const stripe = getStripeClient();
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id parameter" },
        { status: 400 }
      );
    }

    // Retrieve the Checkout Session with line item totals.
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const orderIdFromSessionMetadata =
      typeof session.metadata?.orderId === "string" && session.metadata.orderId
        ? session.metadata.orderId
        : null;

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
    let resolvedOrderId = orderIdFromSessionMetadata;

    if (!resolvedOrderId && paymentIntentId) {
      const linkedPayment = await prisma.paymentTransaction.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { orderId: true },
      });
      resolvedOrderId = linkedPayment?.orderId ?? null;
    }

    return NextResponse.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      currency: session.currency,
      amountSubtotal: session.amount_subtotal,
      amountTax: session.total_details?.amount_tax ?? 0,
      amountTotal: session.amount_total,
      orderId: resolvedOrderId,
    });
  } catch (error) {
    console.error("Error verifying checkout session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify session" },
      { status: 500 }
    );
  }
}
