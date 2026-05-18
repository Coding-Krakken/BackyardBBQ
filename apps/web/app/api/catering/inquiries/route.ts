import { NextResponse } from "next/server";
import { z } from "zod";

const inquirySchema = z.object({
  eventDate: z.string().min(1),
  eventType: z.string().min(1),
  eventAddress: z.string().optional(),
  partySize: z.number().int().min(1),
  packageName: z.string().min(1),
  contactName: z.string().min(2),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7),
  notes: z.string().max(2000).optional(),
  estimatedSubtotalCents: z.number().int().min(0),
  estimatedDepositCents: z.number().int().min(0),
  estimatedBalanceCents: z.number().int().min(0)
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = inquirySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid inquiry payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // TODO: Persist to a dedicated CateringInquiry model and trigger CRM/email workflow.
    const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return NextResponse.json(
      {
        inquiryId,
        message: "Catering inquiry submitted. We will confirm availability and follow up shortly."
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit inquiry." },
      { status: 400 }
    );
  }
}
