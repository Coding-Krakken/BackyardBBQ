import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all completed orders with items
    const orders = await prisma.order.findMany({
      where: {
        customerId: session.user.id,
        status: "completed"
      },
      include: {
        items: true
      }
    });

    // Categorize items based on common BBQ menu patterns
    const categoryMap: Record<string, RegExp[]> = {
      "BBQ Meats": [/brisket/i, /ribs/i, /pulled pork/i, /sausage/i, /chicken/i, /turkey/i, /beef/i, /pork/i],
      "Sides": [/beans/i, /coleslaw/i, /mac.*cheese/i, /potato/i, /corn/i, /salad/i, /pickles/i, /bread/i],
      "Drinks": [/tea/i, /lemonade/i, /soda/i, /water/i, /beer/i, /drink/i, /beverage/i],
      "Desserts": [/pie/i, /cake/i, /cobbler/i, /brownie/i, /cookie/i, /dessert/i],
      "Sauces": [/sauce/i, /rub/i, /seasoning/i],
      "Other": []
    };

    const categorySpending: Record<string, number> = {
      "BBQ Meats": 0,
      "Sides": 0,
      "Drinks": 0,
      "Desserts": 0,
      "Sauces": 0,
      "Other": 0
    };

    // Categorize and sum spending
    orders.forEach((order: typeof orders[number]) => {
      order.items.forEach((item: typeof order.items[number]) => {
        const itemName = item.menuItemName.toLowerCase();
        const totalCents = item.unitPriceCents * item.quantity;
        
        let categorized = false;
        for (const [category, patterns] of Object.entries(categoryMap)) {
          if (patterns.some((pattern) => pattern.test(itemName))) {
            categorySpending[category] = (categorySpending[category] || 0) + totalCents;
            categorized = true;
            break;
          }
        }
        
        if (!categorized) {
          categorySpending["Other"] = (categorySpending["Other"] || 0) + totalCents;
        }
      });
    });

    // Convert to array format and filter out zero-value categories
    const categoryData = Object.entries(categorySpending)
      .filter(([_, cents]) => cents > 0)
      .map(([category, cents]) => ({
        category,
        spending: cents / 100,
        percentage: 0 // Will calculate after
      }));

    // Calculate percentages
    const total = categoryData.reduce((sum, item) => sum + item.spending, 0);
    categoryData.forEach((item) => {
      item.percentage = total > 0 ? Math.round((item.spending / total) * 100) : 0;
    });

    // Sort by spending (descending)
    categoryData.sort((a, b) => b.spending - a.spending);

    return NextResponse.json({
      categoryData,
      totalSpent: total
    });
  } catch (error) {
    console.error("Get category analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch category analytics" },
      { status: 500 }
    );
  }
}
