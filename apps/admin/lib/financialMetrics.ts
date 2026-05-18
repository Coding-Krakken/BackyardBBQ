import { prisma } from "./prisma";
import {
  PAYMENT_SUCCESS_STATUSES,
  PAYMENT_REFUND_STATUSES,
  PAYMENT_REVENUE_STATUSES,
  THIRD_PARTY_DELIVERY_CHANNELS,
} from "@bbq/domain";
import type { PaymentStatus } from "@prisma/client";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface RevenueMetrics {
  grossCents: number;
  refundsCents: number;
  netCents: number;
}

export interface DetailedRevenueMetrics extends RevenueMetrics {
  transactionCount: number;
  successfulCount: number;
  refundedCount: number;
  averagePaymentCents: number;
}

/**
 * Get gross revenue from successful payments within a date range.
 * This is the single source of truth for revenue calculations.
 */
export async function getGrossRevenue(dateRange: DateRange): Promise<number> {
  const result = await prisma.paymentTransaction.aggregate({
    where: {
      status: { in: PAYMENT_REVENUE_STATUSES as unknown as PaymentStatus[] },
      createdAt: { gte: dateRange.from, lte: dateRange.to },
    },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}

/**
 * Get total refunded amount within a date range.
 * Counts the full payment amount for refunded transactions.
 */
export async function getRefunds(dateRange: DateRange): Promise<number> {
  const result = await prisma.paymentTransaction.aggregate({
    where: {
      status: { in: PAYMENT_REFUND_STATUSES as unknown as PaymentStatus[] },
      createdAt: { gte: dateRange.from, lte: dateRange.to },
    },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}

/**
 * Get net revenue (gross minus refunds) within a date range.
 */
export async function getNetRevenue(dateRange: DateRange): Promise<number> {
  const [gross, refunds] = await Promise.all([
    getGrossRevenue(dateRange),
    getRefunds(dateRange),
  ]);
  return Math.max(0, gross - refunds);
}

/**
 * Get comprehensive revenue metrics for a date range.
 * Use this for dashboard summaries that need multiple metrics.
 */
export async function getRevenueMetrics(dateRange: DateRange): Promise<RevenueMetrics> {
  const [grossCents, refundsCents] = await Promise.all([
    getGrossRevenue(dateRange),
    getRefunds(dateRange),
  ]);

  return {
    grossCents,
    refundsCents,
    netCents: Math.max(0, grossCents - refundsCents),
  };
}

/**
 * Get detailed revenue metrics including transaction counts.
 * Use for analytics pages that need more granular data.
 */
export async function getDetailedRevenueMetrics(
  dateRange: DateRange
): Promise<DetailedRevenueMetrics> {
  const [allPayments, successfulPayments, refundedPayments] = await Promise.all([
    prisma.paymentTransaction.aggregate({
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
      _count: true,
      _sum: { amountCents: true },
    }),
    prisma.paymentTransaction.aggregate({
      where: {
        status: { in: PAYMENT_SUCCESS_STATUSES as unknown as PaymentStatus[] },
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
      _count: true,
      _sum: { amountCents: true },
    }),
    prisma.paymentTransaction.aggregate({
      where: {
        status: { in: PAYMENT_REFUND_STATUSES as unknown as PaymentStatus[] },
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
      _count: true,
      _sum: { amountCents: true },
    }),
  ]);

  const grossCents = successfulPayments._sum.amountCents ?? 0;
  const refundsCents = refundedPayments._sum.amountCents ?? 0;
  const transactionCount = allPayments._count;
  const successfulCount = successfulPayments._count;

  return {
    grossCents,
    refundsCents,
    netCents: Math.max(0, grossCents - refundsCents),
    transactionCount,
    successfulCount,
    refundedCount: refundedPayments._count,
    averagePaymentCents:
      successfulCount > 0 ? Math.round(grossCents / successfulCount) : 0,
  };
}

/**
 * Get revenue breakdown by source (direct, catering, delivery channels).
 * Delivery channels track revenue via IntegrationEvent settlements, not PaymentTransaction.
 */
export async function getRevenueBySource(dateRange: DateRange): Promise<
  Array<{ source: string; grossCents: number; refundsCents: number; netCents: number }>
> {
  // Get Stripe-based payments with their order source
  const stripePayments = await prisma.paymentTransaction.findMany({
    where: {
      status: { in: PAYMENT_REVENUE_STATUSES as unknown as PaymentStatus[] },
      createdAt: { gte: dateRange.from, lte: dateRange.to },
    },
    select: {
      amountCents: true,
      status: true,
      order: { select: { source: true } },
    },
  });

  const refundedPayments = await prisma.paymentTransaction.findMany({
    where: {
      status: { in: PAYMENT_REFUND_STATUSES as unknown as PaymentStatus[] },
      createdAt: { gte: dateRange.from, lte: dateRange.to },
    },
    select: {
      amountCents: true,
      order: { select: { source: true } },
    },
  });

  // Aggregate by source
  const bySource = new Map<
    string,
    { grossCents: number; refundsCents: number }
  >();

  for (const payment of stripePayments) {
    const source = payment.order?.source ?? "direct";
    const current = bySource.get(source) ?? { grossCents: 0, refundsCents: 0 };
    current.grossCents += payment.amountCents;
    bySource.set(source, current);
  }

  for (const payment of refundedPayments) {
    const source = payment.order?.source ?? "direct";
    const current = bySource.get(source) ?? { grossCents: 0, refundsCents: 0 };
    current.refundsCents += payment.amountCents;
    bySource.set(source, current);
  }

  // Get delivery channel settlements from IntegrationEvent
  const deliverySettlements = await prisma.integrationEvent.findMany({
    where: {
      channel: { in: [...THIRD_PARTY_DELIVERY_CHANNELS] },
      eventType: { contains: "settlement" },
      status: "processed",
      createdAt: { gte: dateRange.from, lte: dateRange.to },
    },
    select: { channel: true, payload: true },
  });

  for (const event of deliverySettlements) {
    const payload = event.payload as Record<string, unknown> | null;
    const settlement =
      payload?.settlement && typeof payload.settlement === "object"
        ? (payload.settlement as Record<string, unknown>)
        : payload;

    const netCents =
      typeof settlement?.netCents === "number" ? settlement.netCents : 0;

    const current = bySource.get(event.channel) ?? {
      grossCents: 0,
      refundsCents: 0,
    };
    current.grossCents += netCents; // Delivery settlements report net (after fees)
    bySource.set(event.channel, current);
  }

  return Array.from(bySource.entries()).map(([source, totals]) => ({
    source,
    grossCents: totals.grossCents,
    refundsCents: totals.refundsCents,
    netCents: Math.max(0, totals.grossCents - totals.refundsCents),
  }));
}

/**
 * Check data integrity between Orders and PaymentTransactions.
 * Returns details about orphaned records and sum mismatches.
 */
export async function checkDataIntegrity(): Promise<{
  healthy: boolean;
  ordersWithoutPayments: number;
  paymentsWithoutOrders: number;
  orderSumCents: number;
  paymentSumCents: number;
  sumDifferenceCents: number;
  details?: string;
}> {
  // Count orders from Stripe-based sources without payments
  const ordersWithoutPayments = await prisma.order.count({
    where: {
      source: { in: ["direct", "catering"] },
      status: { notIn: ["cancelled", "pending"] },
      payment: null,
    },
  });

  // Count payments without linked orders (excluding catering deposits)
  const paymentsWithoutOrders = await prisma.paymentTransaction.count({
    where: {
      orderId: null,
      paymentType: "order", // Exclude deposit-type payments
    },
  });

  // Sum orders from Stripe sources
  const orderSum = await prisma.order.aggregate({
    where: {
      source: { in: ["direct", "catering"] },
      status: { notIn: ["cancelled"] },
    },
    _sum: { totalCents: true },
  });

  // Sum successful payments
  const paymentSum = await prisma.paymentTransaction.aggregate({
    where: {
      status: { in: PAYMENT_REVENUE_STATUSES as unknown as PaymentStatus[] },
    },
    _sum: { amountCents: true },
  });

  const orderSumCents = orderSum._sum.totalCents ?? 0;
  const paymentSumCents = paymentSum._sum.amountCents ?? 0;
  const sumDifferenceCents = Math.abs(orderSumCents - paymentSumCents);

  const healthy =
    ordersWithoutPayments === 0 &&
    paymentsWithoutOrders === 0 &&
    sumDifferenceCents === 0;

  const details = healthy
    ? undefined
    : [
        ordersWithoutPayments > 0 &&
          `${ordersWithoutPayments} orders without payment records`,
        paymentsWithoutOrders > 0 &&
          `${paymentsWithoutOrders} payments without linked orders`,
        sumDifferenceCents > 0 &&
          `$${(sumDifferenceCents / 100).toFixed(2)} discrepancy between order totals and payment totals`,
      ]
        .filter(Boolean)
        .join("; ");

  return {
    healthy,
    ordersWithoutPayments,
    paymentsWithoutOrders,
    orderSumCents,
    paymentSumCents,
    sumDifferenceCents,
    details,
  };
}
