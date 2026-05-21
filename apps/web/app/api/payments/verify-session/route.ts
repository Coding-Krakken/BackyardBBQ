import { NextRequest, NextResponse } from "next/server";
import { findEposTransactionByReferenceCode } from "../../../../lib/epos-now";
import { getPaymentProvider, unsupportedProviderMessage } from "../../../lib/payment-provider";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const provider = getPaymentProvider();
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id parameter" },
        { status: 400 }
      );
    }

    if (provider !== "epos") {
      return NextResponse.json(
        { error: unsupportedProviderMessage("/api/payments/verify-session") },
        { status: 501 }
      );
    }

    if (sessionId.startsWith("epos_booking_")) {
      const bookingId = sessionId.slice("epos_booking_".length);

      const booking = await prisma.cateringBooking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          depositCents: true,
        },
      });

      if (!booking) {
        return NextResponse.json(
          { error: "Booking not found for session_id" },
          { status: 404 }
        );
      }

      const linkedDeposit = await prisma.paymentTransaction.findFirst({
        where: {
          bookingId: booking.id,
          paymentType: "deposit",
        },
        orderBy: { updatedAt: "desc" },
        select: {
          status: true,
          amountCents: true,
          currency: true,
        },
      });

      let remoteStatusId: number | undefined;
      try {
        const remoteTransaction = await findEposTransactionByReferenceCode(`booking:${booking.id}`);
        remoteStatusId = remoteTransaction?.statusId;
      } catch {
        // Fall back to local status when EPOS lookup is temporarily unavailable.
      }

      const isComplete = remoteStatusId === 1 || linkedDeposit?.status === "succeeded";

      const amountTotal = linkedDeposit?.amountCents ?? booking.depositCents ?? 0;

      return NextResponse.json({
        provider,
        status: isComplete ? "complete" : "open",
        paymentStatus: isComplete ? "paid" : "unpaid",
        customerEmail: undefined,
        currency: linkedDeposit?.currency ?? "usd",
        amountSubtotal: amountTotal,
        amountTax: 0,
        amountTotal,
        orderId: null,
        bookingId: booking.id,
      });
    }

    const orderId = sessionId.startsWith("epos_order_")
      ? sessionId.slice("epos_order_".length)
      : sessionId;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        currency: true,
        subtotalCents: true,
        taxCents: true,
        totalCents: true,
        status: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found for session_id" },
        { status: 404 }
      );
    }

    const linkedPayment = await prisma.paymentTransaction.findUnique({
      where: { orderId: order.id },
      select: { status: true },
    });

    let remoteStatusId: number | undefined;
    try {
      const remoteTransaction = await findEposTransactionByReferenceCode(order.id);
      remoteStatusId = remoteTransaction?.statusId;
    } catch {
      // Fall back to local status when EPOS lookup is temporarily unavailable.
    }

    const isComplete =
      remoteStatusId === 1
      || linkedPayment?.status === "succeeded"
      || order.status === "confirmed"
      || order.status === "completed";

    return NextResponse.json({
      provider,
      status: isComplete ? "complete" : "open",
      paymentStatus: isComplete ? "paid" : "unpaid",
      customerEmail: undefined,
      currency: order.currency,
      amountSubtotal: order.subtotalCents,
      amountTax: order.taxCents,
      amountTotal: order.totalCents,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Error verifying checkout session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify session" },
      { status: 500 }
    );
  }
}
