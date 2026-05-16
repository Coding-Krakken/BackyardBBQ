import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DEFAULT_TAX_RATE = 0.08;
const TAX_RATE = Number(process.env.SALES_TAX_RATE ?? DEFAULT_TAX_RATE);

const lineItemSchema = z.object({
  unitPriceCents: z.number().int().min(0),
  quantity: z.number().int().min(1),
  customizations: z.array(z.object({ priceCents: z.number().int().min(0) })).optional(),
});

const requestSchema = z.object({
  subtotalCents: z.number().int().min(0).optional(),
  items: z.array(lineItemSchema).optional(),
  currency: z.string().default("usd"),
  shippingAddress: z
    .object({
      country: z.string().trim().min(2).max(2).optional(),
      state: z.string().trim().max(100).optional(),
      postalCode: z.string().trim().max(20).optional(),
    })
    .optional(),
});

type LineItemInput = z.output<typeof lineItemSchema>;

function computeSubtotalFromItems(items: LineItemInput[]) {
  return items.reduce((sum, item) => {
    const customizationTotal = (item.customizations ?? []).reduce(
      (customSum, customization) => customSum + customization.priceCents,
      0
    );

    return sum + (item.unitPriceCents + customizationTotal) * item.quantity;
  }, 0);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid tax calculation payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { subtotalCents, items, currency } = parsed.data;

    const computedSubtotalCents = items?.length
      ? computeSubtotalFromItems(items)
      : subtotalCents;

    if (typeof computedSubtotalCents !== "number") {
      return NextResponse.json(
        { error: "Provide either subtotalCents or items for tax calculation" },
        { status: 400 }
      );
    }

    const estimatedTaxCents = Math.round(computedSubtotalCents * TAX_RATE);
    const totalCents = computedSubtotalCents + estimatedTaxCents;

    return NextResponse.json({
      subtotalCents: computedSubtotalCents,
      estimatedTaxCents,
      totalCents,
      taxRate: TAX_RATE,
      currency,
    });
  } catch (error) {
    console.error("Calculate tax error:", error);
    return NextResponse.json(
      { error: "Failed to calculate tax" },
      { status: 500 }
    );
  }
}
