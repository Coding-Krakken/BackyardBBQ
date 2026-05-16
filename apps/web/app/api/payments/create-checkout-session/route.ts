import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { z } from "zod";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { checkRateLimit } from "../../../../lib/rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

const DEFAULT_TAX_RATE = 0.08;
const ALLOWED_DRIFT_CENTS = 1;
const SERVER_TAX_RATE = Number(process.env.SALES_TAX_RATE ?? DEFAULT_TAX_RATE);
const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_WINDOW_MS = 60 * 1000;

const metadataSchema = z
  .object({
    subtotalCents: z.number().int().min(0).optional(),
    clientTaxCents: z.number().int().min(0).optional(),
    idempotencyKey: z.string().trim().min(8).max(200).optional(),
  })
  .passthrough();

function getRequestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

const requestSchema = z.object({
  amountCents: z.number().int().min(50),
  currency: z.string().default("usd"),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const rateCheck = checkRateLimit({
      key: `checkout:${ip}`,
      limit: CHECKOUT_RATE_LIMIT,
      windowMs: CHECKOUT_RATE_WINDOW_MS,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many checkout requests. Please wait and try again.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsedBody = requestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Invalid checkout payload",
          details: parsedBody.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { amountCents, currency, metadata } = parsedBody.data;

    const parsedMetadata = metadataSchema.safeParse(metadata);
    if (!parsedMetadata.success) {
      return NextResponse.json(
        {
          error: "Invalid checkout metadata",
          details: parsedMetadata.error.flatten(),
        },
        { status: 400 }
      );
    }

    const subtotalCents = parsedMetadata.data.subtotalCents;
    const clientTaxCents = parsedMetadata.data.clientTaxCents;
    const metadataIdempotencyKey = parsedMetadata.data.idempotencyKey;
    const lineItemAmountCents =
      typeof subtotalCents === "number" ? subtotalCents : amountCents;

    if (typeof subtotalCents === "number") {
      const totalDrift = Math.abs(amountCents - subtotalCents);

      if (totalDrift > ALLOWED_DRIFT_CENTS) {
        return NextResponse.json(
          {
            error: "Subtotal validation failed",
            details: {
              expectedSubtotalCents: subtotalCents,
              providedAmountCents: amountCents,
            },
          },
          { status: 400 }
        );
      }
    }

    const requestIdempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    const stripeIdempotencyKey =
      requestIdempotencyKey || metadataIdempotencyKey || undefined;

    if (typeof subtotalCents === "number" && typeof clientTaxCents === "number") {
      const estimatedServerTaxCents = Math.round(subtotalCents * SERVER_TAX_RATE);
      const driftPercent =
        estimatedServerTaxCents === 0
          ? 0
          : Math.abs(clientTaxCents - estimatedServerTaxCents) / estimatedServerTaxCents;

      if (driftPercent > 0.01) {
        console.warn("Checkout tax drift warning", {
          subtotalCents,
          clientTaxCents,
          estimatedServerTaxCents,
          driftPercent,
        });
      }
    }

    const stripeMetadata = Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, String(value)])
    );

    const authSession = await getServerSession(authOptions);
    let stripeCustomerId: string | undefined;

    if (authSession?.user?.id && authSession.user.email) {
      const customer = await prisma.customer.findUnique({
        where: { id: authSession.user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          stripeCustomerId: true,
        },
      });

      if (customer) {
        stripeCustomerId = customer.stripeCustomerId ?? undefined;

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
            data: {
              stripeCustomerId,
            },
          });
        }
      }
    }

    // Create Checkout Session with ui_mode: "embedded" for Payment Element
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        ui_mode: "embedded",
        mode: "payment",
        customer: stripeCustomerId,
        line_items: [
          {
            price_data: {
              currency,
              unit_amount: lineItemAmountCents,
              product_data: {
                name: "Backyard BBQ Order",
                description: "Premium BBQ order from Backyard BBQ King",
              },
            },
            quantity: 1,
          },
        ],
        // Stripe Tax computes final tax based on customer location.
        automatic_tax: {
          enabled: true,
        },
        customer_update: {
          address: "auto",
        },
        payment_intent_data: {
          setup_future_usage: stripeCustomerId ? "off_session" : undefined,
        },
        // Add metadata for searchability and reporting
        metadata: {
          source: "web-checkout",
          serverTaxRate: String(SERVER_TAX_RATE),
          serverEstimatedTaxCents:
            typeof subtotalCents === "number"
              ? String(Math.round(subtotalCents * SERVER_TAX_RATE))
              : "0",
          ...stripeMetadata,
        },
        // Return URL for after payment confirmation
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      },
      stripeIdempotencyKey ? { idempotencyKey: stripeIdempotencyKey } : undefined
    );

    return NextResponse.json({
      clientSecret: checkoutSession.client_secret,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
