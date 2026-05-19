import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "../../../../../../lib/requireAdmin";
import { prisma } from "../../../../../../lib/prisma";

function extractSettlementId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (record.settlement && typeof record.settlement === "object") {
    const settlementRecord = record.settlement as Record<string, unknown>;
    return typeof settlementRecord.settlementId === "string" ? settlementRecord.settlementId : null;
  }

  return typeof record.settlementId === "string" ? record.settlementId : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const correlationId = params.id?.trim();
  if (!correlationId) {
    return NextResponse.json({ message: "Missing correlation ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 1000) : 200;

  const where: Prisma.IntegrationEventWhereInput = {
    OR: [
      { correlationId },
      {
        payload: {
          path: ["correlationId"],
          equals: correlationId
        }
      }
    ]
  };

  const events = await prisma.integrationEvent.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      eventType: true,
      status: true,
      orderId: true,
      correlationId: true,
      createdAt: true,
      payload: true
    }
  });

  const eventOrderIds = events
    .map((event) => event.orderId)
    .filter((orderId): orderId is string => typeof orderId === "string" && orderId.length > 0);

  const [payments, orders] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        OR: [
          { correlationId },
          eventOrderIds.length > 0 ? { orderId: { in: eventOrderIds } } : undefined
        ].filter(Boolean) as Prisma.PaymentTransactionWhereInput[]
      },
      take: limit,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        orderId: true,
        stripePaymentIntentId: true,
        amountCents: true,
        currency: true,
        status: true,
        paymentType: true,
        correlationId: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { correlationId },
          eventOrderIds.length > 0 ? { id: { in: eventOrderIds } } : undefined
        ].filter(Boolean) as Prisma.OrderWhereInput[]
      },
      take: limit,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        source: true,
        status: true,
        externalChannel: true,
        externalOrderId: true,
        totalCents: true,
        correlationId: true,
        createdAt: true,
        updatedAt: true
      }
    })
  ]);

  const summary = {
    total: events.length + payments.length + orders.length,
    events: events.length,
    payments: payments.length,
    orders: orders.length,
    channels: {} as Record<string, number>,
    statuses: {} as Record<string, number>,
    eventTypes: {} as Record<string, number>
  };

  const data = events.map((event) => {
    summary.channels[event.channel] = (summary.channels[event.channel] ?? 0) + 1;
    summary.statuses[event.status] = (summary.statuses[event.status] ?? 0) + 1;
    summary.eventTypes[event.eventType] = (summary.eventTypes[event.eventType] ?? 0) + 1;

    const payload = event.payload as Record<string, unknown>;
    return {
      id: event.id,
      channel: event.channel,
      eventType: event.eventType,
      status: event.status,
      orderId: event.orderId,
      correlationId: event.correlationId,
      settlementId: extractSettlementId(payload),
      createdAt: event.createdAt.toISOString(),
      payload
    };
  });

  const paymentData = payments.map((payment) => ({
    id: payment.id,
    type: "payment",
    orderId: payment.orderId,
    paymentIntentId: payment.stripePaymentIntentId,
    amountCents: payment.amountCents,
    currency: payment.currency,
    status: payment.status,
    paymentType: payment.paymentType,
    correlationId: payment.correlationId,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString()
  }));

  const orderData = orders.map((order) => ({
    id: order.id,
    type: "order",
    source: order.source,
    status: order.status,
    externalChannel: order.externalChannel,
    externalOrderId: order.externalOrderId,
    totalCents: order.totalCents,
    correlationId: order.correlationId,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString()
  }));

  const timeline = [
    ...data.map((event) => ({
      id: event.id,
      type: "event",
      channel: event.channel,
      eventType: event.eventType,
      status: event.status,
      orderId: event.orderId,
      correlationId: event.correlationId,
      settlementId: event.settlementId,
      createdAt: event.createdAt
    })),
    ...paymentData,
    ...orderData
  ].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  return NextResponse.json({
    correlationId,
    limit,
    summary,
    data,
    payments: paymentData,
    orders: orderData,
    timeline
  });
}
