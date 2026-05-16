import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { calculateCateringPricing } from "../../../../lib/catering-pricing";

const createBookingSchema = z.object({
  eventDate: z.string().min(1),
  partySize: z.number().int().min(1),
  eventAddress: z.string().trim().min(3).optional(),
  packageName: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(2000).optional(),
  locationId: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid booking payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const eventDate = new Date(parsed.data.eventDate);
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Invalid event date" }, { status: 400 });
    }

    const now = new Date();
    if (eventDate.getTime() < now.getTime()) {
      return NextResponse.json({ error: "Event date must be in the future" }, { status: 400 });
    }

    const location = parsed.data.locationId
      ? await prisma.location.findFirst({
          where: { id: parsed.data.locationId, isActive: true },
          select: { id: true },
        })
      : await prisma.location.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });

    if (!location) {
      return NextResponse.json({ error: "No active catering location found" }, { status: 400 });
    }

    const pricing = calculateCateringPricing({
      partySize: parsed.data.partySize,
      packageName: parsed.data.packageName,
    });

    const booking = await prisma.cateringBooking.create({
      data: {
        customerId: session.user.id,
        locationId: location.id,
        eventDate,
        partySize: parsed.data.partySize,
        eventAddress: parsed.data.eventAddress,
        packageName: parsed.data.packageName,
        notes: parsed.data.notes,
        status: "pending_approval",
        estimatedTotalCents: pricing.estimatedTotalCents,
        depositCents: pricing.depositCents,
        finalPaymentCents: pricing.finalPaymentCents,
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

    return NextResponse.json({
      booking,
      pricing,
      message: "Booking created. We will review and approve it before deposit payment.",
    });
  } catch (error) {
    console.error("Create booking error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
