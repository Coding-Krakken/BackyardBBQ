import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
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

    // Get all completed orders for this customer
    const orders = await prisma.order.findMany({
      where: {
        customerId: session.user.id,
        status: "completed"
      },
      include: {
        items: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    // Calculate monthly spending for the last 12 months
    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(now.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    // Initialize monthly data
    const monthlySpending: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      const date = new Date(twelveMonthsAgo);
      date.setMonth(date.getMonth() + i);
      const key = date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
      monthlySpending[key] = 0;
    }

    // Aggregate spending by month
    orders.forEach((order: typeof orders[number]) => {
      const orderDate = new Date(order.createdAt);
      if (orderDate >= twelveMonthsAgo) {
        const key = orderDate.toLocaleDateString("en-US", { year: "numeric", month: "short" });
        if (monthlySpending.hasOwnProperty(key)) {
          monthlySpending[key] = (monthlySpending[key] || 0) + order.totalCents;
        }
      }
    });

    // Convert to array format for charts
    const monthlyData = Object.entries(monthlySpending).map(([month, cents]) => ({
      month,
      spending: cents / 100 // Convert to dollars
    }));

    // Calculate YTD spending (current year)
    const currentYear = now.getFullYear();
    const ytdOrders = orders.filter((order: typeof orders[number]) => {
      const orderYear = new Date(order.createdAt).getFullYear();
      return orderYear === currentYear;
    });
    const ytdTotal = ytdOrders.reduce((sum: number, order: typeof orders[number]) => sum + order.totalCents, 0);

    // Calculate average order value
    const totalSpent = orders.reduce((sum: number, order: typeof orders[number]) => sum + order.totalCents, 0);
    const averageOrderValue = orders.length > 0 ? totalSpent / orders.length : 0;

    // Find top spending month
    const topMonth = Object.entries(monthlySpending).reduce(
      (max, [month, cents]) => {
        return cents > max.cents ? { month, cents } : max;
      },
      { month: "", cents: 0 }
    );

    return NextResponse.json({
      monthlyData,
      stats: {
        ytdTotal: ytdTotal / 100,
        averageOrderValue: averageOrderValue / 100,
        totalOrders: orders.length,
        topMonth: topMonth.month || "N/A",
        topMonthSpending: topMonth.cents / 100
      }
    });
  } catch (error) {
    console.error("Get spending analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch spending analytics" },
      { status: 500 }
    );
  }
}
