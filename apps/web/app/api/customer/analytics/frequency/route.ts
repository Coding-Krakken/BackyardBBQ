import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all completed orders
    const orders = await prisma.order.findMany({
      where: {
        customerId: session.user.id,
        status: "completed"
      },
      select: {
        createdAt: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (orders.length === 0) {
      return NextResponse.json({
        frequencyData: [],
        insights: {
          totalOrders: 0,
          averagePerMonth: 0,
          mostActiveDay: "N/A",
          orderingStreak: 0
        }
      });
    }

    // Calculate day of week frequency
    const dayFrequency: Record<string, number> = {
      Sunday: 0,
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0
    };

    const monthFrequency: Record<string, number> = {};
    
    orders.forEach((order: typeof orders[number]) => {
      const date = new Date(order.createdAt);
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      const monthKey = date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
      
      dayFrequency[dayName] = (dayFrequency[dayName] || 0) + 1;
      monthFrequency[monthKey] = (monthFrequency[monthKey] || 0) + 1;
    });

    // Find most active day
    const mostActiveDay = Object.entries(dayFrequency).reduce(
      (max, [day, count]) => {
        return count > max.count ? { day, count } : max;
      },
      { day: "N/A", count: 0 }
    );

    // Calculate average orders per month
    const uniqueMonths = Object.keys(monthFrequency).length;
    const averagePerMonth = uniqueMonths > 0 ? orders.length / uniqueMonths : 0;

    // Calculate current ordering streak (consecutive months with orders)
    const now = new Date();
    let streak = 0;
    for (let i = 0; i < 12; i++) {
      const checkDate = new Date(now);
      checkDate.setMonth(checkDate.getMonth() - i);
      const key = checkDate.toLocaleDateString("en-US", { year: "numeric", month: "short" });
      
      if (monthFrequency[key] && monthFrequency[key] > 0) {
        streak++;
      } else {
        break;
      }
    }

    // Format day frequency data for charts
    const frequencyData = Object.entries(dayFrequency).map(([day, count]) => ({
      day,
      orders: count
    }));

    // Sort by day of week
    const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    frequencyData.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

    return NextResponse.json({
      frequencyData,
      insights: {
        totalOrders: orders.length,
        averagePerMonth: Math.round(averagePerMonth * 10) / 10,
        mostActiveDay: mostActiveDay.day,
        orderingStreak: streak
      }
    });
  } catch (error) {
    console.error("Get frequency analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch frequency analytics" },
      { status: 500 }
    );
  }
}
