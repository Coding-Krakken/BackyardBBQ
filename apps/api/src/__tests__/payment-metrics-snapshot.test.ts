import { buildPaymentMetricsSnapshot } from "../metrics/paymentSnapshot";

describe("buildPaymentMetricsSnapshot", () => {
  it("aggregates metrics without loading full payment/event row sets", async () => {
    const mockPrisma = {
      paymentTransaction: {
        groupBy: jest.fn(async () => [
          { status: "succeeded", _count: { _all: 10 }, _sum: { amountCents: 125000 } },
          { status: "refunded", _count: { _all: 2 }, _sum: { amountCents: 7000 } }
        ]),
        // Presence-only regression guard; should remain unused.
        findMany: jest.fn()
      },
      integrationEvent: {
        count: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(5),
        findFirst: jest.fn(async () => ({ createdAt: new Date("2026-05-19T14:00:00.000Z") })),
        // Presence-only regression guard; should remain unused.
        findMany: jest.fn()
      },
      $queryRaw: jest.fn(async () => [{ average_latency_ms: 87.4 }])
    };

    const snapshot = await buildPaymentMetricsSnapshot({
      days: 30,
      hasDatabaseUrl: true,
      prisma: mockPrisma as never
    });

    expect(snapshot.windowDays).toBe(30);
    expect(snapshot.kpis.totalTransactions).toBe(12);
    expect(snapshot.kpis.successfulTransactions).toBe(10);
    expect(snapshot.kpis.refundedTransactions).toBe(2);
    expect(snapshot.kpis.settledVolumeCents).toBe(132000);
    expect(snapshot.kpis.refundedVolumeCents).toBe(7000);
    expect(snapshot.kpis.disputeCount).toBe(1);
    expect(snapshot.kpis.webhookEvents).toBe(5);
    expect(snapshot.kpis.averageWebhookLatencyMs).toBe(87);
    expect(snapshot.kpis.lastWebhookAt).toBe("2026-05-19T14:00:00.000Z");

    expect(mockPrisma.paymentTransaction.groupBy).toHaveBeenCalledTimes(1);
    expect(mockPrisma.integrationEvent.count).toHaveBeenCalledTimes(2);
    expect(mockPrisma.integrationEvent.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);

    expect(mockPrisma.paymentTransaction.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.integrationEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns zeroed snapshot when database is disabled", async () => {
    const snapshot = await buildPaymentMetricsSnapshot({
      days: 7,
      hasDatabaseUrl: false,
      prisma: {} as never
    });

    expect(snapshot.windowDays).toBe(7);
    expect(snapshot.kpis.totalTransactions).toBe(0);
    expect(snapshot.kpis.webhookEvents).toBe(0);
    expect(snapshot.kpis.lastWebhookAt).toBeNull();
  });
});
