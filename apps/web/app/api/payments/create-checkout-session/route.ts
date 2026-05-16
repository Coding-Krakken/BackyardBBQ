import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amountCents, currency = "usd", metadata = {} } = body;

    if (!amountCents || typeof amountCents !== "number" || amountCents <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Create Checkout Session with ui_mode: "embedded" for Payment Element
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: "Backyard BBQ Order",
              description: "Premium BBQ order from Backyard BBQ King",
            },
          },
          quantity: 1,
        },
      ],
      // Enable automatic tax calculation if configured
      automatic_tax: {
        enabled: false, // Set to true if you configure tax settings in Stripe Dashboard
      },
      // Add metadata for searchability and reporting
      metadata: {
        source: "web-checkout",
        ...metadata,
      },
      // Return URL for after payment confirmation
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
