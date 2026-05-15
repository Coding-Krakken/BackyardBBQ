import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

    const where: any = {
      customerId: session.user.id
    };

    if (upcoming) {
      where.eventDate = {
        gte: new Date()
      };
      where.status = {
        in: ["pending_approval", "approved"]
      };
    }

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

    return NextResponse.json({
      bookings,
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
