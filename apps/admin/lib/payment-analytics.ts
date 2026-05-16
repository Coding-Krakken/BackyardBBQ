import { prisma } from "@/lib/prisma";

export type PaymentAnalyticsData = {
  range: {
    startDate: string;
    endDate: string;
  };
  kpis: {
    totalVolumeCents: number;
    successfulVolumeCents: number;
    totalTransactions: number;
    successfulTransactions: number;
    refundedTransactions: number;
    disputeCount: number;
    refundRate: number;
    disputeRate: number;
    successRate: number;
    averagePaymentCents: number;
  };
  dailyVolume: Array<{ date: string; volumeCents: number }>;
  dailyRefunds: Array<{ date: string; refundsCents: number }>;
  paymentTypeBreakdown: Array<{ type: string; count: number }>;
};

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toPercent(value: number) {
  return Number((value * 100).toFixed(2));
}

export async function getPaymentAnalytics(startDate: Date, endDate: Date): Promise<PaymentAnalyticsData> {
  const payments = await prisma.paymentTransaction.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      amountCents: true,
      status: true,
      createdAt: true,
      paymentType: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const disputes = await prisma.integrationEvent.count({
    where: {
      eventType: { contains: "dispute" },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const successfulStatuses = new Set(["succeeded", "completed"]);
  const refundedStatuses = new Set(["refunded", "partially_refunded"]);

  let totalVolumeCents = 0;
  let successfulVolumeCents = 0;
  let successfulTransactions = 0;
  let refundedTransactions = 0;

  const dailyVolumeMap = new Map<string, number>();
  const dailyRefundMap = new Map<string, number>();
  const paymentTypeMap = new Map<string, number>();

  for (const payment of payments) {
    totalVolumeCents += payment.amountCents;

    const status = payment.status;
    const dateKey = toDateKey(payment.createdAt);

    if (successfulStatuses.has(status)) {
      successfulTransactions += 1;
      successfulVolumeCents += payment.amountCents;
      dailyVolumeMap.set(dateKey, (dailyVolumeMap.get(dateKey) ?? 0) + payment.amountCents);
    }

    if (refundedStatuses.has(status)) {
      refundedTransactions += 1;
      dailyRefundMap.set(dateKey, (dailyRefundMap.get(dateKey) ?? 0) + payment.amountCents);
    }

    const type = payment.paymentType?.trim() || "order";
    paymentTypeMap.set(type, (paymentTypeMap.get(type) ?? 0) + 1);
  }

  const totalTransactions = payments.length;
  const averagePaymentCents = totalTransactions > 0 ? Math.round(totalVolumeCents / totalTransactions) : 0;

  return {
    range: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    kpis: {
      totalVolumeCents,
      successfulVolumeCents,
      totalTransactions,
      successfulTransactions,
      refundedTransactions,
      disputeCount: disputes,
      refundRate: totalTransactions > 0 ? toPercent(refundedTransactions / totalTransactions) : 0,
      disputeRate: totalTransactions > 0 ? toPercent(disputes / totalTransactions) : 0,
      successRate: totalTransactions > 0 ? toPercent(successfulTransactions / totalTransactions) : 0,
      averagePaymentCents,
    },
    dailyVolume: Array.from(dailyVolumeMap.entries()).map(([date, volumeCents]) => ({ date, volumeCents })),
    dailyRefunds: Array.from(dailyRefundMap.entries()).map(([date, refundsCents]) => ({ date, refundsCents })),
    paymentTypeBreakdown: Array.from(paymentTypeMap.entries()).map(([type, count]) => ({
      type,
      count,
    })),
  };
}
