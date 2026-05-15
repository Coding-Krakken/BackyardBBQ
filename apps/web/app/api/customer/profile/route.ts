import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerified: true,
        preferredLocationId: true,
        dietaryPreferences: true,
        notificationSettings: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, phone, preferredLocationId, dietaryPreferences, notificationSettings } = body;

    const customer = await prisma.customer.update({
      where: { id: session.user.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(preferredLocationId !== undefined && { preferredLocationId }),
        ...(dietaryPreferences !== undefined && { dietaryPreferences }),
        ...(notificationSettings !== undefined && { notificationSettings })
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerified: true,
        preferredLocationId: true,
        dietaryPreferences: true,
        notificationSettings: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
