import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const booking = await prisma.cateringBooking.findFirst({
      where: {
        id,
        customerId: session.user.id,
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const successfulPayments = await prisma.paymentTransaction.findMany({
      where: {
        bookingId: booking.id,
        status: "succeeded",
      },
      select: {
        id: true,
        amountCents: true,
        currency: true,
        status: true,
        paymentType: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const depositPaidCents = successfulPayments
      .filter((payment) => payment.paymentType === "deposit")
      .reduce((sum, payment) => sum + payment.amountCents, 0);

    return NextResponse.json({
      booking,
      payments: successfulPayments,
      depositPaidCents,
      depositDueCents: Math.max(0, (booking.depositCents ?? 0) - depositPaidCents),
    });
  } catch (error) {
    console.error("Get booking detail error:", error);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}
