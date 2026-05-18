import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { z } from "zod";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { checkRateLimit } from "../../../../lib/rate-limit";

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
}

const DEFAULT_TAX_RATE = 0.08;
const ALLOWED_DRIFT_CENTS = 1;
const SERVER_TAX_RATE = Number(process.env.SALES_TAX_RATE ?? DEFAULT_TAX_RATE);
const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_WINDOW_MS = 60 * 1000;

const metadataSchema = z
  .object({
    subtotalCents: z.number().int().min(0).optional(),
    tipCents: z.number().int().min(0).optional(),
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
  locationId: z.string().trim().min(1).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    // Validate required environment variables
    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      console.error("Missing NEXT_PUBLIC_SITE_URL environment variable");
      return NextResponse.json(
        {
          error: "Server configuration error. Please contact support.",
        },
        { status: 500 }
      );
    }

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

    const { amountCents, currency, locationId, metadata } = parsedBody.data;

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
    const tipCents = parsedMetadata.data.tipCents ?? 0;
    const clientTaxCents = parsedMetadata.data.clientTaxCents;
    const metadataIdempotencyKey = parsedMetadata.data.idempotencyKey;
    const metadataLocationId = typeof metadata.locationId === "string" ? metadata.locationId : undefined;
    const effectiveLocationId = locationId ?? metadataLocationId;
    const subtotalLineItemCents =
      typeof subtotalCents === "number"
        ? subtotalCents
        : Math.max(amountCents - tipCents, 0);

    if (typeof subtotalCents === "number") {
      const expectedAmountCents = subtotalCents + tipCents;
      const totalDrift = Math.abs(amountCents - expectedAmountCents);

      if (totalDrift > ALLOWED_DRIFT_CENTS) {
        return NextResponse.json(
          {
            error: "Subtotal validation failed",
            details: {
              expectedAmountCents,
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

    const resolvedLocation = effectiveLocationId
      ? await prisma.location.findFirst({ where: { id: effectiveLocationId, isActive: true }, select: { id: true } })
      : await prisma.location.findFirst({ where: { isActive: true }, select: { id: true } });

    if (!resolvedLocation) {
      return NextResponse.json(
        { error: "No active location available for checkout" },
        { status: 503 }
      );
    }

    // Compute tax server-side (Syracuse, NY: 8% on prepared food)
    const taxCents = Math.round(subtotalLineItemCents * SERVER_TAX_RATE);

    // Create Order in DB before Stripe session
    const order = await prisma.order.create({
      data: {
        customerId: authSession?.user?.id ?? null,
        locationId: resolvedLocation.id,
        source: "direct",
        status: "pending",
        subtotalCents: subtotalLineItemCents,
        taxCents,
        tipCents,
        totalCents: subtotalLineItemCents + taxCents + tipCents,
        currency,
      },
    });

    let checkoutSession: { client_secret: string | null; id: string };
    try {
      // Create Checkout Session with ui_mode: "elements" for PaymentElement / ExpressCheckoutElement
      checkoutSession = await stripe.checkout.sessions.create(
        {
          ui_mode: "elements",
          mode: "payment",
          customer: stripeCustomerId,
          line_items: [
            {
              price_data: {
                currency,
                unit_amount: subtotalLineItemCents,
                product_data: {
                  name: "Backyard BBQ Order",
                  description: "Premium BBQ order from Backyard BBQ King",
                },
              },
              quantity: 1,
            },
            ...(tipCents > 0
              ? [
                  {
                    price_data: {
                      currency,
                      unit_amount: tipCents,
                      product_data: {
                        name: "Tip",
                        description: "Customer gratuity",
                      },
                    },
                    quantity: 1,
                  },
                ]
              : []),
            ...(taxCents > 0
              ? [
                  {
                    price_data: {
                      currency,
                      unit_amount: taxCents,
                      product_data: {
                        name: "Sales Tax",
                        description: `NY State + Onondaga County (${(SERVER_TAX_RATE * 100).toFixed(0)}%)`,
                      },
                    },
                    quantity: 1,
                  },
                ]
              : []),
          ],
          payment_intent_data: {
            setup_future_usage: stripeCustomerId ? "off_session" : undefined,
            metadata: {
              ...stripeMetadata,
              orderId: order.id,
              source: "web-checkout",
              locationId: resolvedLocation.id,
            },
          },
          // Add metadata for searchability and reporting
          metadata: {
            ...stripeMetadata,
            source: "web-checkout",
            orderId: order.id,
            locationId: resolvedLocation.id,
            serverTaxRate: String(SERVER_TAX_RATE),
            serverEstimatedTaxCents:
              typeof subtotalCents === "number"
                ? String(Math.round(subtotalCents * SERVER_TAX_RATE))
                : "0",
          },
          // Return URL for after payment confirmation
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        },
        stripeIdempotencyKey ? { idempotencyKey: stripeIdempotencyKey } : undefined
      );
    } catch (stripeError) {
      await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
      throw stripeError;
    }

    return NextResponse.json({
      clientSecret: checkoutSession.client_secret,
      sessionId: checkoutSession.id,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
