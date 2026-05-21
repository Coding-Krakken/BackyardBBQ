/** @jest-environment node */

class MockNextResponse {
  status: number;
  private readonly body: unknown;

  constructor(body: unknown, init?: { status?: number }) {
    this.body = body;
    this.status = init?.status ?? 200;
  }

  static json(body: unknown, init?: { status?: number }) {
    return new MockNextResponse(body, init);
  }

  async json() {
    return this.body;
  }
}

jest.mock("next/server", () => ({
  NextResponse: MockNextResponse,
}));

const mockRequireAdmin = jest.fn();
const mockPrisma = {
  paymentTransaction: {
    findMany: jest.fn(),
  },
  integrationEvent: {
    findMany: jest.fn(),
  },
};

jest.mock("@/lib/requireAdmin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/admin/payments", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("infers epos provider from payment transaction reference prefix", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findMany.mockResolvedValue([
      {
        id: "ptx_1",
        paymentType: "order",
        stripePaymentIntentId: "epos_txn_456",
        amountCents: 3200,
        currency: "usd",
        status: "succeeded",
        createdAt: new Date("2026-05-20T12:00:00.000Z"),
      },
    ]);
    mockPrisma.integrationEvent.findMany.mockResolvedValue([]);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      {
        url: "https://example.test/api/admin/payments?limit=20&offset=0",
      } as never
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data[0].provider).toBe("epos");
  });

  it("uses refund event provider metadata when present", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findMany.mockResolvedValue([
      {
        id: "ptx_1",
        paymentType: "order",
        stripePaymentIntentId: "pi_123",
        amountCents: 5000,
        currency: "usd",
        status: "partially_refunded",
        createdAt: new Date("2026-05-20T12:00:00.000Z"),
      },
    ]);
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        payload: {
          transactionId: "ptx_1",
          requestedAmountCents: 1200,
          totalRefundedCents: 1200,
          reason: "requested_by_customer",
          provider: "epos",
        },
        createdAt: new Date("2026-05-20T12:10:00.000Z"),
      },
    ]);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      {
        url: "https://example.test/api/admin/payments?limit=20&offset=0",
      } as never
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data[0].provider).toBe("epos");
    expect(payload.data[0].refundHistory[0]).toEqual(
      expect.objectContaining({ amountCents: 1200, totalRefundedCents: 1200 })
    );
  });

  it("includes payment_refund_created events and parses numeric string amounts", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.paymentTransaction.findMany.mockResolvedValue([
      {
        id: "ptx_2",
        paymentType: "order",
        stripePaymentIntentId: "epos_txn_777",
        amountCents: 5000,
        currency: "usd",
        status: "partially_refunded",
        createdAt: new Date("2026-05-20T12:00:00.000Z"),
      },
    ]);
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        eventType: "admin.payment_refund_created",
        payload: {
          transactionId: "ptx_2",
          paymentIntentId: "epos_txn_777",
          refundAmountCents: "900",
          totalRefundedCents: "1900",
          reason: "requested_by_customer",
        },
        createdAt: new Date("2026-05-20T12:15:00.000Z"),
      },
    ]);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      {
        url: "https://example.test/api/admin/payments?limit=20&offset=0",
      } as never
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data[0].provider).toBe("epos");
    expect(payload.data[0].refundHistory[0]).toEqual(
      expect.objectContaining({ amountCents: 900, totalRefundedCents: 1900 })
    );
  });
});
