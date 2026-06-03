import { NextResponse } from "next/server";
import { cateringInquiryFormSchema } from "@bbq/domain";
import { prisma } from "@bbq/database";
import { sendCateringInquiryNotification, sendCateringConfirmation } from "../../../../lib/email";

function generateReferenceNumber(): string {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CAT-${datePart}-${randomPart}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = cateringInquiryFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid inquiry payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { eventDate, partySize, eventLocation, foodPreferences, contactName, contactEmail, contactPhone, additionalNotes } = parsed.data;

    const referenceNumber = generateReferenceNumber();

    const inquiry = await prisma.cateringInquiry.create({
      data: {
        referenceNumber,
        eventDate: new Date(eventDate),
        partySize,
        eventLocation,
        foodPreferences,
        contactName,
        contactEmail,
        contactPhone,
        additionalNotes: additionalNotes || null,
        status: "pending",
      },
    });

    // Send emails (non-blocking — don't fail the request if email fails)
    const emailData = {
      referenceNumber,
      eventDate,
      partySize,
      eventLocation,
      foodPreferences,
      contactName,
      contactEmail,
      contactPhone,
      additionalNotes,
    };

    void sendCateringInquiryNotification(emailData);
    void sendCateringConfirmation(emailData);

    return NextResponse.json(
      {
        referenceNumber: inquiry.referenceNumber,
        message: "Catering inquiry submitted. We'll be in touch within 24 hours."
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[catering/inquiries] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit inquiry." },
      { status: 500 }
    );
  }
}
