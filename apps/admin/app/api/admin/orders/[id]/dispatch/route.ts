import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const requestSchema = {
  channelValues: ["doordash", "ubereats", "grubhub"] as const,
  priorityValues: ["normal", "high"] as const
};

type DispatchChannel = (typeof requestSchema.channelValues)[number];
type DispatchPriority = (typeof requestSchema.priorityValues)[number];

function isDispatchChannel(value: string): value is DispatchChannel {
  return requestSchema.channelValues.includes(value as DispatchChannel);
}

function isDispatchPriority(value: string): value is DispatchPriority {
  return requestSchema.priorityValues.includes(value as DispatchPriority);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "manager", "staff"]);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    channel?: string;
    priority?: string;
  };

  if (!body.channel || !isDispatchChannel(body.channel)) {
    return NextResponse.json({ message: "Invalid dispatch channel" }, { status: 400 });
  }

  const priority = body.priority && isDispatchPriority(body.priority) ? body.priority : "normal";

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      totalCents: true
    }
  });

  if (!order) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  if (order.status === "completed" || order.status === "cancelled") {
    return NextResponse.json(
      { message: "Order is no longer dispatchable", status: order.status },
      { status: 409 }
    );
  }

  const dispatchId = `${body.channel}-${order.id}-${Date.now()}`;

  await prisma.integrationEvent.create({
    data: {
      orderId: order.id,
      channel: body.channel,
      eventType: "delivery.dispatch.requested",
      status: "queued",
      payload: {
        dispatchId,
        orderId: order.id,
        priority,
        amountCents: order.totalCents,
        requestedByRole: auth.role,
        queuedAt: new Date().toISOString()
      }
    }
  });

  return NextResponse.json({
    data: {
      queued: true,
      dispatchId,
      channel: body.channel,
      orderId: order.id,
      priority
    }
  });
}
