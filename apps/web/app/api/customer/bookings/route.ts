import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Prisma.CateringBookingWhereInput = {
      customerId: session.user.id,
      ...(upcoming ? {
        eventDate: { gte: new Date() },
        status: { in: ["pending_approval", "approved"] }
      } : {})
    };

    const [bookings, total] = await Promise.all([
      prisma.cateringBooking.findMany({
        where,
        include: {
          location: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        },
        orderBy: {
          eventDate: upcoming ? "asc" : "desc"
        },
        take: limit,
        skip: offset
      }),
      prisma.cateringBooking.count({ where })
    ]);

    const bookingIds = bookings.map((booking) => booking.id);
    const successfulPayments = bookingIds.length
      ? await prisma.paymentTransaction.findMany({
          where: {
            bookingId: { in: bookingIds },
            status: "succeeded",
          },
          select: {
            bookingId: true,
            amountCents: true,
            paymentType: true,
          },
        })
      : [];

    const depositPaidByBookingId = new Map<string, number>();
    for (const payment of successfulPayments) {
      if (!payment.bookingId || payment.paymentType !== "deposit") {
        continue;
      }
      const current = depositPaidByBookingId.get(payment.bookingId) ?? 0;
      depositPaidByBookingId.set(payment.bookingId, current + payment.amountCents);
    }

    const enrichedBookings = bookings.map((booking) => {
      const depositPaidCents = depositPaidByBookingId.get(booking.id) ?? 0;
      const depositDueCents = Math.max(0, (booking.depositCents ?? 0) - depositPaidCents);

      return {
        ...booking,
        depositPaidCents,
        depositDueCents,
      };
    });

    return NextResponse.json({
      bookings: enrichedBookings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
