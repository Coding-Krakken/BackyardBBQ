import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { createEposTransaction, getEposTenderTypeId } from "../../../../lib/epos-now";
import { authOptions } from "../../../../lib/auth";
import { getPaymentProvider, unsupportedProviderMessage } from "../../../lib/payment-provider";
import { prisma } from "../../../../lib/prisma";

const requestSchema = z.object({
  bookingId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const provider = getPaymentProvider();

    if (provider !== "epos") {
      return NextResponse.json(
        { error: unsupportedProviderMessage("/api/payments/create-catering-deposit-session") },
        { status: 501 }
      );
    }

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

    const referenceCode = `booking:${booking.id}`;
    const tenderTypeId = getEposTenderTypeId();

    const createdTransaction = await createEposTransaction({
      DateTime: new Date().toISOString(),
      StatusId: 1,
      ServiceType: 1,
      TotalAmount: Number((depositCents / 100).toFixed(2)),
      ServiceCharge: 0,
      Gratuity: 0,
      IsTransactionIncTax: true,
      ReferenceCode: referenceCode,
      TransactionItems: [],
      MiscProductItems: [],
      Tenders: [
        {
          TenderTypeId: tenderTypeId,
          Amount: Number((depositCents / 100).toFixed(2)),
          ChangeGiven: 0,
        },
      ],
      AdjustStock: false,
    });

    const existingDepositPayment = await prisma.paymentTransaction.findFirst({
      where: {
        bookingId: booking.id,
        paymentType: "deposit",
      },
      select: { id: true },
    });

    if (existingDepositPayment) {
      await prisma.paymentTransaction.update({
        where: { id: existingDepositPayment.id },
        data: {
          customerId: session.user.id,
          amountCents: depositCents,
          currency: "usd",
          status: "succeeded",
          stripePaymentIntentId: `epos_txn_${createdTransaction.id}`,
        },
      });
    } else {
      await prisma.paymentTransaction.create({
        data: {
          customerId: session.user.id,
          bookingId: booking.id,
          paymentType: "deposit",
          stripePaymentIntentId: `epos_txn_${createdTransaction.id}`,
          amountCents: depositCents,
          currency: "usd",
          status: "succeeded",
        },
      });
    }

    return NextResponse.json({
      clientSecret: null,
      sessionId: `epos_booking_${booking.id}`,
      amountCents: depositCents,
      provider,
    });
  } catch (error) {
    console.error("Create catering deposit session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create catering deposit session" },
      { status: 500 }
    );
  }
}
