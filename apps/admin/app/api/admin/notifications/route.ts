import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    target: 'all' | string; // 'all' or customer ID
    type: 'order_update' | 'booking_update' | 'payment_update' | 'referral_reward' | 'promotional';
    title: string;
    message: string;
    actionUrl?: string;
  };

  if (body.target === 'all') {
    // Create notifications for all customers
    const customers = await prisma.customer.findMany({
      select: { id: true }
    });

    const notifications = customers.map(c => ({
      customerId: c.id,
      type: body.type,
      title: body.title,
      message: body.message,
      actionUrl: body.actionUrl ?? null,
      read: false
    }));

    await prisma.notification.createMany({
      data: notifications
    });

    return NextResponse.json({
      message: `Sent ${notifications.length} notifications`,
      count: notifications.length
    }, { status: 201 });
  } else {
    // Send to specific customer
    const notification = await prisma.notification.create({
      data: {
        customerId: body.target,
        type: body.type,
        title: body.title,
        message: body.message,
        actionUrl: body.actionUrl ?? null,
        read: false
      }
    });

    return NextResponse.json({ data: notification }, { status: 201 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  // Get recent sent notifications
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      customer: {
        select: { email: true, firstName: true, lastName: true }
      }
    }
  });

  return NextResponse.json({ data: notifications });
}
