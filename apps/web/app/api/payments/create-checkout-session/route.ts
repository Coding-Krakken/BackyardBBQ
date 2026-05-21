import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "../../../../lib/auth";
import { createEposTransaction, getEposTenderTypeId } from "../../../../lib/epos-now";
import { getPaymentProvider, unsupportedProviderMessage } from "../../../lib/payment-provider";
import { prisma } from "../../../../lib/prisma";
import { checkRateLimit } from "../../../../lib/rate-limit";

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
    const provider = getPaymentProvider();

    if (provider !== "epos") {
      return NextResponse.json(
        { error: unsupportedProviderMessage("/api/payments/create-checkout-session") },
        { status: 501 }
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

    const authSession = await getServerSession(authOptions);

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

    // Create Order before creating the EPOS transaction.
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

    try {
      const referenceCode = order.id;
      const tenderTypeId = getEposTenderTypeId();
      const serviceTypeRaw =
        typeof metadata.fulfillmentMode === "string"
          ? metadata.fulfillmentMode.toLowerCase()
          : "pickup";
      const serviceType = serviceTypeRaw === "delivery" ? 2 : 1;

      const createdTransaction = await createEposTransaction({
        DateTime: new Date().toISOString(),
        StatusId: 1,
        ServiceType: serviceType,
        TotalAmount: Number((amountCents / 100).toFixed(2)),
        ServiceCharge: 0,
        Gratuity: Number((tipCents / 100).toFixed(2)),
        IsTransactionIncTax: true,
        ReferenceCode: referenceCode,
        TransactionItems: [],
        MiscProductItems: [],
        Tenders: [
          {
            TenderTypeId: tenderTypeId,
            Amount: Number((amountCents / 100).toFixed(2)),
            ChangeGiven: 0,
          },
        ],
        AdjustStock: false,
      });

      await prisma.paymentTransaction.upsert({
        where: { orderId: order.id },
        update: {
          amountCents,
          currency,
          status: "succeeded",
          stripePaymentIntentId: `epos_txn_${createdTransaction.id}`,
        },
        create: {
          orderId: order.id,
          customerId: authSession?.user?.id ?? null,
          paymentType: "order",
          stripePaymentIntentId: `epos_txn_${createdTransaction.id}`,
          amountCents,
          currency,
          status: "succeeded",
        },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { status: "confirmed" },
      });

      const eposSessionId = `epos_order_${order.id}`;

      return NextResponse.json({
        provider,
        clientSecret: null,
        sessionId: eposSessionId,
        orderId: order.id,
        transactionId: createdTransaction.id,
      });
    } catch (eposError) {
      await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
      throw eposError;
    }
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
