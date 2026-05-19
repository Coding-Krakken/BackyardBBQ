import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

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
    const parsedLimit = parseInt(searchParams.get("limit") || "50", 10);
    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const where = {
      customerId: session.user.id,
      ...(upcoming ? {
        eventDate: { gte: new Date() },
        status: { in: ["pending_approval", "approved"] as const }
      } : {})
    };

    const [bookings, total] = await Promise.all([
      prisma.cateringBooking.findMany({
        where: where as any,
        include: {
          location: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          payments: {
            where: {
              status: "succeeded"
            },
            select: {
              amountCents: true,
              paymentType: true
            }
          },
        },
        orderBy: {
          eventDate: upcoming ? "asc" : "desc"
        },
        take: limit,
        skip: offset
      }),
      prisma.cateringBooking.count({ where: where as any })
    ]);

    const enrichedBookings = bookings.map((booking: {
      depositCents: number | null;
      payments: Array<{ amountCents: number; paymentType: string | null }>;
    }) => {
      const depositPaidCents = booking.payments
        .filter((payment) => payment.paymentType === "deposit")
        .reduce((sum, payment) => sum + payment.amountCents, 0);
      const depositDueCents = Math.max(0, (booking.depositCents ?? 0) - depositPaidCents);

      const { payments, ...bookingWithoutPayments } = booking;

      return {
        ...bookingWithoutPayments,
        depositPaidCents,
        depositDueCents,
      };
    });

    const response = NextResponse.json({
      bookings: enrichedBookings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > 200) {
      console.warn("Get bookings latency threshold exceeded", {
        customerId: session.user.id,
        elapsedMs,
        bookingCount: bookings.length,
        limit,
        offset,
        upcoming,
      });
    }

    return response;
  } catch (error) {
    console.error("Get bookings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
