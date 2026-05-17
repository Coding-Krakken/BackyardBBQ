import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const channels = ["doordash", "ubereats", "grubhub"] as const;
const actions = ["accept", "reject", "cancel", "preparing", "ready", "out_for_delivery", "delivered"] as const;

type DeliveryChannel = (typeof channels)[number];
type DeliveryAction = (typeof actions)[number];

function isDeliveryChannel(value: string): value is DeliveryChannel {
  return channels.includes(value as DeliveryChannel);
}

function isDeliveryAction(value: string): value is DeliveryAction {
  return actions.includes(value as DeliveryAction);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "manager", "staff"]);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    channel?: string;
    action?: string;
    reason?: string;
  };

  if (!body.channel || !isDeliveryChannel(body.channel)) {
    return NextResponse.json({ message: "Invalid delivery channel" }, { status: 400 });
  }

  if (!body.action || !isDeliveryAction(body.action)) {
    return NextResponse.json({ message: "Invalid delivery action" }, { status: 400 });
  }

  const mapActionToStatus: Record<DeliveryAction, "accepted" | "cancelled" | "preparing" | "ready" | "out_for_delivery" | "delivered"> = {
    accept: "accepted",
    reject: "cancelled",
    cancel: "cancelled",
    preparing: "preparing",
    ready: "ready",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered"
  };

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true
    }
  });

  if (!order) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  const duplicateEvents = await prisma.integrationEvent.findMany({
    where: {
      orderId: order.id,
      channel: body.channel,
      eventType: "delivery.order.action.requested",
      status: { in: ["queued", "pending", "processed"] },
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      createdAt: true,
      payload: true
    }
  });

  const duplicateAction = duplicateEvents.find((event) => {
    const payload = event.payload as Record<string, unknown>;
    return payload.action === body.action;
  });

  if (duplicateAction) {
    const payload = duplicateAction.payload as Record<string, unknown>;
    return NextResponse.json({
      data: {
        queued: duplicateAction.status !== "processed",
        duplicate: true,
        eventId: duplicateAction.id,
        action: body.action,
        mappedStatus: payload.mappedStatus,
        createdAt: duplicateAction.createdAt.toISOString()
      }
    });
  }

  const mappedStatus = mapActionToStatus[body.action];

  const event = await prisma.integrationEvent.create({
    data: {
      orderId: order.id,
      channel: body.channel,
      eventType: "delivery.order.action.requested",
      status: "queued",
      payload: {
        orderId: order.id,
        orderExternalId: `${body.channel}:${order.id}`,
        action: body.action,
        mappedStatus,
        reason: body.reason ?? null,
        attempts: 0,
        queuedByRole: auth.role,
        queuedAt: new Date().toISOString()
      }
    },
    select: { id: true, createdAt: true }
  });

  return NextResponse.json({
    data: {
      queued: true,
      eventId: event.id,
      orderId: order.id,
      channel: body.channel,
      action: body.action,
      mappedStatus,
      createdAt: event.createdAt.toISOString()
    }
  });
}
