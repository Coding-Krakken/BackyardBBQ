import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import {
  PAYMENT_REVENUE_STATUSES,
  PAYMENT_REFUND_STATUSES,
  THIRD_PARTY_DELIVERY_CHANNELS,
} from "@bbq/domain";
import type { PaymentStatus } from "@prisma/client";

const deliveryChannels = [...THIRD_PARTY_DELIVERY_CHANNELS] as const;

function parseRange(fromRaw: string | null, toRaw: string | null) {
  const now = new Date();

  const from = fromRaw ? new Date(`${fromRaw}T00:00:00.000Z`) : new Date(now);
  from.setUTCHours(0, 0, 0, 0);

  const to = toRaw ? new Date(`${toRaw}T23:59:59.999Z`) : new Date(now);
  to.setUTCHours(23, 59, 59, 999);

  return { from, to };
}

function extractSettlementTotals(payload: unknown) {
  const asRecord = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!asRecord) {
    return { grossCents: 0, feesCents: 0, netCents: 0 };
  }

  const settlement =
    asRecord.settlement && typeof asRecord.settlement === "object"
      ? (asRecord.settlement as Record<string, unknown>)
      : asRecord;

  return {
    grossCents: typeof settlement.grossCents === "number" ? settlement.grossCents : 0,
    feesCents: typeof settlement.feesCents === "number" ? settlement.feesCents : 0,
    netCents: typeof settlement.netCents === "number" ? settlement.netCents : 0
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const { from, to } = parseRange(searchParams.get("from"), searchParams.get("to"));

  // Use PaymentTransaction as the single source of truth for Stripe revenue
  const [successfulPayments, refundedPayments, settlements] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: { in: PAYMENT_REVENUE_STATUSES as unknown as PaymentStatus[] },
      },
      select: {
        amountCents: true,
        status: true,
        order: {
          select: {
            source: true,
          },
        },
      },
    }),
    prisma.paymentTransaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: { in: PAYMENT_REFUND_STATUSES as unknown as PaymentStatus[] },
      },
      select: {
        amountCents: true,
        order: {
          select: {
            source: true,
          },
        },
      },
    }),
    prisma.integrationEvent.findMany({
      where: {
        channel: { in: [...deliveryChannels] },
        eventType: { contains: "settlement" },
        status: "processed",
        createdAt: { gte: from, lte: to },
      },
      select: {
        channel: true,
        payload: true,
      },
    }),
  ]);

  // Build source breakdown from PaymentTransaction data
  const bySource = new Map<string, { grossCents: number; refundsCents: number; netCents: number }>();

  for (const payment of successfulPayments) {
    const source = payment.order?.source ?? "direct";
    const current = bySource.get(source) ?? { grossCents: 0, refundsCents: 0, netCents: 0 };
    current.grossCents += payment.amountCents;
    current.netCents += payment.amountCents;
    bySource.set(source, current);
  }

  for (const refund of refundedPayments) {
    const source = refund.order?.source ?? "direct";
    const current = bySource.get(source) ?? { grossCents: 0, refundsCents: 0, netCents: 0 };
    current.refundsCents += refund.amountCents;
    current.netCents = Math.max(0, current.netCents - refund.amountCents);
    bySource.set(source, current);
  }

  const settlementByChannel = new Map<string, { grossCents: number; feesCents: number; netCents: number }>();
  let settlementNetCents = 0;

  for (const settlementEvent of settlements) {
    const totals = extractSettlementTotals(settlementEvent.payload);
    settlementNetCents += totals.netCents;

    const current = settlementByChannel.get(settlementEvent.channel) ?? {
      grossCents: 0,
      feesCents: 0,
      netCents: 0
    };
    current.grossCents += totals.grossCents;
    current.feesCents += totals.feesCents;
    current.netCents += totals.netCents;
    settlementByChannel.set(settlementEvent.channel, current);
  }

  // Calculate totals from PaymentTransaction (single source of truth)
  const grossCents = successfulPayments.reduce((sum, p) => sum + p.amountCents, 0);
  const refundsCents = refundedPayments.reduce((sum, p) => sum + p.amountCents, 0);
  const netCents = Math.max(0, grossCents - refundsCents);

  return NextResponse.json({
    grossCents,
    refundsCents,
    netCents,
    settlementNetCents,
    netAfterSettlementCents: Math.max(0, netCents - settlementNetCents),
    sourceBreakdown: Array.from(bySource.entries()).map(([source, totals]) => ({
      source,
      grossCents: totals.grossCents,
      refundsCents: totals.refundsCents,
      netCents: totals.netCents
    })),
    settlementByChannel: Array.from(settlementByChannel.entries()).map(([channel, totals]) => ({
      channel,
      grossCents: totals.grossCents,
      feesCents: totals.feesCents,
      netCents: totals.netCents
    })),
    canFinalize: auth.role === "owner"
  });
}
