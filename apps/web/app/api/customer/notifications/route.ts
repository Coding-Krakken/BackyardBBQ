import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/customer/notifications - Fetch all notifications for logged-in customer
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
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");

    const notifications = await prisma.notification.findMany({
      where: {
        customerId: session.user.id,
        ...(unreadOnly && { read: false })
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    const unreadCount = await prisma.notification.count({
      where: {
        customerId: session.user.id,
        read: false
      }
    });

    return NextResponse.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// PATCH /api/customer/notifications - Mark notification(s) as read
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
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          customerId: session.user.id,
          read: false
        },
        data: {
          read: true
        }
      });

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read"
      });
    } else if (notificationId) {
      // Mark specific notification as read
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          customerId: session.user.id
        }
      });

      if (!notification) {
        return NextResponse.json(
          { error: "Notification not found" },
          { status: 404 }
        );
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true }
      });

      return NextResponse.json({
        success: true,
        notification: await prisma.notification.findUnique({
          where: { id: notificationId }
        })
      });
    } else {
      return NextResponse.json(
        { error: "Either notificationId or markAllRead must be provided" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Update notifications error:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}

// DELETE /api/customer/notifications - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get("id");

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      );
    }

    // Verify notification belongs to customer
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        customerId: session.user.id
      }
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    await prisma.notification.delete({
      where: { id: notificationId }
    });

    return NextResponse.json({
      success: true,
      message: "Notification deleted"
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}
