import {
  checkDataIntegrity,
  getRevenueBySource,
  getRevenueMetrics,
} from "../financialMetrics";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    paymentTransaction: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    integrationEvent: {
      findMany: jest.fn(),
    },
    order: {
      aggregate: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const { prisma: mockPrisma } = jest.requireMock("@/lib/prisma") as {
  prisma: {
    paymentTransaction: {
      aggregate: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    integrationEvent: { findMany: jest.Mock };
    order: { aggregate: jest.Mock; count: jest.Mock };
  };
};

describe("financialMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getRevenueMetrics", () => {
    it("returns gross, refunds and net from payment aggregates", async () => {
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amountCents: 12000 } })
        .mockResolvedValueOnce({ _sum: { amountCents: 2500 } });

      const result = await getRevenueMetrics({
        from: new Date("2026-05-01T00:00:00.000Z"),
        to: new Date("2026-05-31T23:59:59.999Z"),
      });

      expect(result).toEqual({
        grossCents: 12000,
        refundsCents: 2500,
        netCents: 9500,
      });
      expect(mockPrisma.paymentTransaction.aggregate).toHaveBeenCalledTimes(2);
    });

    it("clamps net to zero when refunds exceed gross", async () => {
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amountCents: 1000 } })
        .mockResolvedValueOnce({ _sum: { amountCents: 5000 } });

      const result = await getRevenueMetrics({
        from: new Date("2026-05-01T00:00:00.000Z"),
        to: new Date("2026-05-31T23:59:59.999Z"),
      });

      expect(result.netCents).toBe(0);
    });
  });

  describe("getRevenueBySource", () => {
    it("combines stripe payments, refunds, and delivery settlements", async () => {
      mockPrisma.paymentTransaction.findMany
        .mockResolvedValueOnce([
          { amountCents: 5000, status: "succeeded", order: { source: "direct" } },
          { amountCents: 8000, status: "succeeded", order: { source: "catering" } },
        ])
        .mockResolvedValueOnce([
          { amountCents: 1000, order: { source: "direct" } },
        ]);

      mockPrisma.integrationEvent.findMany.mockResolvedValueOnce([
        { channel: "doordash", payload: { settlement: { netCents: 2200 } } },
      ]);

      const rows = await getRevenueBySource({
        from: new Date("2026-05-01T00:00:00.000Z"),
        to: new Date("2026-05-31T23:59:59.999Z"),
      });

      const bySource = new Map(rows.map((row) => [row.source, row]));
      expect(bySource.get("direct")).toEqual({
        source: "direct",
        grossCents: 5000,
        refundsCents: 1000,
        netCents: 4000,
      });
      expect(bySource.get("catering")?.grossCents).toBe(8000);
      expect(bySource.get("doordash")?.grossCents).toBe(2200);
    });
  });

  describe("checkDataIntegrity", () => {
    it("returns healthy true when all counters are clean and sums match", async () => {
      mockPrisma.order.count.mockResolvedValueOnce(0);
      mockPrisma.paymentTransaction.count.mockResolvedValueOnce(0);
      mockPrisma.order.aggregate.mockResolvedValueOnce({ _sum: { totalCents: 9900 } });
      mockPrisma.paymentTransaction.aggregate.mockResolvedValueOnce({ _sum: { amountCents: 9900 } });

      const result = await checkDataIntegrity();

      expect(result.healthy).toBe(true);
      expect(result.sumDifferenceCents).toBe(0);
      expect(result.details).toBeUndefined();
    });

    it("returns healthy false with useful details when mismatches exist", async () => {
      mockPrisma.order.count.mockResolvedValueOnce(2);
      mockPrisma.paymentTransaction.count.mockResolvedValueOnce(1);
      mockPrisma.order.aggregate.mockResolvedValueOnce({ _sum: { totalCents: 10000 } });
      mockPrisma.paymentTransaction.aggregate.mockResolvedValueOnce({ _sum: { amountCents: 7000 } });

      const result = await checkDataIntegrity();

      expect(result.healthy).toBe(false);
      expect(result.sumDifferenceCents).toBe(3000);
      expect(result.details).toContain("2 orders without payment records");
      expect(result.details).toContain("1 payments without linked orders");
      expect(result.details).toContain("$30.00 discrepancy");
    });
  });
});
