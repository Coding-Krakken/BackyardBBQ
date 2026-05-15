import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    // Fetch the original order with items
    const originalOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        location: true
      }
    });

    if (!originalOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Verify the order belongs to the current customer
    if (originalOrder.customerId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized - Order does not belong to customer" },
        { status: 403 }
      );
    }

    // Check if location is still active
    if (!originalOrder.location.isActive) {
      return NextResponse.json(
        { error: "Location is no longer available" },
        { status: 400 }
      );
    }

    // Get current menu items to validate availability
    const menuItems = await prisma.menuItem.findMany({
      where: {
        locationId: originalOrder.locationId,
        isAvailable: true
      }
    });

    const menuItemMap = new Map(
      menuItems.map((item) => [item.name.toLowerCase(), item])
    );

    // Validate and prepare reorder items
    const reorderItems = [];
    const unavailableItems = [];

    for (const item of originalOrder.items) {
      const menuItem = menuItemMap.get(item.menuItemName.toLowerCase());
      
      if (menuItem) {
        reorderItems.push({
          menuItemName: item.menuItemName,
          quantity: item.quantity,
          unitPriceCents: menuItem.basePriceCents, // Use current price
          notes: item.notes
        });
      } else {
        unavailableItems.push(item.menuItemName);
      }
    }

    if (reorderItems.length === 0) {
      return NextResponse.json(
        { 
          error: "No items from the original order are currently available",
          unavailableItems
        },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotalCents = reorderItems.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0
    );
    const taxCents = Math.round(subtotalCents * 0.0825); // 8.25% tax
    const totalCents = subtotalCents + taxCents;

    // Create new order
    const newOrder = await prisma.order.create({
      data: {
        customerId: session.user.id,
        locationId: originalOrder.locationId,
        source: "direct",
        status: "pending",
        subtotalCents,
        taxCents,
        tipCents: 0,
        totalCents,
        currency: "usd",
        items: {
          create: reorderItems
        }
      },
      include: {
        items: true,
        location: true
      }
    });

    return NextResponse.json({
      success: true,
      order: newOrder,
      unavailableItems: unavailableItems.length > 0 ? unavailableItems : undefined,
      message: unavailableItems.length > 0
        ? `Order created, but ${unavailableItems.length} item(s) were unavailable and excluded`
        : "Order created successfully"
    });
  } catch (error) {
    console.error("Reorder error:", error);
    return NextResponse.json(
      { error: "Failed to create reorder" },
      { status: 500 }
    );
  }
}
