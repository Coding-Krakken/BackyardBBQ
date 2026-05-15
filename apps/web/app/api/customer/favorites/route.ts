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

    // Get all completed orders with items for this customer
    const orders = await prisma.order.findMany({
      where: {
        customerId: session.user.id,
        status: "completed"
      },
      include: {
        items: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    // Count frequency of each menu item
    const itemFrequency = new Map<string, {
      name: string;
      count: number;
      totalSpentCents: number;
      lastOrderedAt: Date;
    }>();

    for (const order of orders) {
      for (const item of order.items) {
        const existing = itemFrequency.get(item.menuItemName);
        
        if (existing) {
          existing.count += item.quantity;
          existing.totalSpentCents += item.unitPriceCents * item.quantity;
          if (order.createdAt > existing.lastOrderedAt) {
            existing.lastOrderedAt = order.createdAt;
          }
        } else {
          itemFrequency.set(item.menuItemName, {
            name: item.menuItemName,
            count: item.quantity,
            totalSpentCents: item.unitPriceCents * item.quantity,
            lastOrderedAt: order.createdAt
          });
        }
      }
    }

    // Convert to array and sort by frequency
    const favorites = Array.from(itemFrequency.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 favorites

    // Get current menu items to check availability
    const menuItems = await prisma.menuItem.findMany({
      where: {
        name: {
          in: favorites.map((f) => f.name)
        },
        isAvailable: true
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      }
    });

    const menuItemMap = new Map(
      menuItems.map((item: any) => [item.name, item])
    );

    // Enrich favorites with current availability and pricing
    const enrichedFavorites = favorites.map((fav) => {
      const menuItem = menuItemMap.get(fav.name);
      return {
        ...fav,
        available: !!menuItem,
        currentPriceCents: menuItem?.basePriceCents,
        locationId: menuItem?.locationId,
        locationName: menuItem?.location.name
      };
    });

    return NextResponse.json({
      favorites: enrichedFavorites,
      totalOrders: orders.length
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}
