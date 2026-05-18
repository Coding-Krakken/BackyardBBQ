import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { z } from "zod";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
}

const requestSchema = z.object({
  bookingId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const booking = await prisma.cateringBooking.findFirst({
      where: {
        id: parsed.data.bookingId,
        customerId: session.user.id,
      },
      select: {
        id: true,
        eventDate: true,
        partySize: true,
        packageName: true,
        status: true,
        depositCents: true,
        estimatedTotalCents: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (!["approved", "pending_approval"].includes(booking.status)) {
      return NextResponse.json(
        { error: "Deposit payment is unavailable for this booking status" },
        { status: 400 }
      );
    }

    const depositCents = booking.depositCents ?? 0;
    if (depositCents <= 0) {
      return NextResponse.json({ error: "Deposit amount is not configured" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        stripeCustomerId: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    let stripeCustomerId = customer.stripeCustomerId;

    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: customer.email,
        name:
          [customer.firstName, customer.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || undefined,
        metadata: {
          customerId: customer.id,
        },
      });

      stripeCustomerId = stripeCustomer.id;

      await prisma.customer.update({
        where: { id: customer.id },
        data: { stripeCustomerId },
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      ui_mode: "elements",
      mode: "payment",
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: depositCents,
            product_data: {
              name: "Backyard BBQ Catering Deposit",
              description: `Deposit for booking ${booking.id.slice(0, 8)} (${booking.partySize} guests)`,
            },
          },
          quantity: 1,
        },
      ],
      automatic_tax: {
        enabled: true,
      },
      customer_update: {
        address: "auto",
      },
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      metadata: {
        source: "catering-deposit",
        bookingId: booking.id,
        paymentType: "deposit",
        estimatedTotalCents: String(booking.estimatedTotalCents ?? 0),
        eventDate: booking.eventDate.toISOString(),
      },
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/catering/bookings/${booking.id}/deposit/success?session_id={CHECKOUT_SESSION_ID}`,
    });

    return NextResponse.json({
      clientSecret: checkoutSession.client_secret,
      sessionId: checkoutSession.id,
      amountCents: depositCents,
    });
  } catch (error) {
    console.error("Create catering deposit session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create catering deposit session" },
      { status: 500 }
    );
  }
}
