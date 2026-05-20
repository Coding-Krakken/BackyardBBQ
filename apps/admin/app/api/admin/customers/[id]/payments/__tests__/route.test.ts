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
  customer: {
    findUnique: jest.fn(),
  },
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

describe("GET /api/admin/customers/[id]/payments", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("returns provider-aware payment rows and counts disputes across stripe+epos references", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.customer.findUnique.mockResolvedValue({ id: "cust_1" });

    mockPrisma.paymentTransaction.findMany
      .mockResolvedValueOnce([
        {
          id: "pt_1",
          stripePaymentIntentId: "pi_123",
          orderId: "order_1",
          bookingId: null,
          paymentType: "order",
          status: "succeeded",
          amountCents: 4200,
          currency: "usd",
          createdAt: new Date("2026-05-20T10:00:00.000Z"),
        },
        {
          id: "pt_2",
          stripePaymentIntentId: "epos_txn_900",
          orderId: "order_2",
          bookingId: null,
          paymentType: "order",
          status: "succeeded",
          amountCents: 5100,
          currency: "usd",
          createdAt: new Date("2026-05-20T11:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          stripePaymentIntentId: "pi_123",
          orderId: "order_1",
          bookingId: null,
          status: "succeeded",
          amountCents: 4200,
        },
        {
          stripePaymentIntentId: "epos_txn_900",
          orderId: "order_2",
          bookingId: null,
          status: "succeeded",
          amountCents: 5100,
        },
      ]);

    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "evt_stripe_dispute",
        payload: {
          disputeId: "dp_1",
          paymentIntentId: "pi_123",
        },
      },
      {
        id: "evt_epos_dispute",
        payload: {
          disputeId: "epos_case_1",
          eposTransactionId: "900",
        },
      },
      {
        id: "evt_admin_dispute",
        payload: {
          disputeId: "case_admin_1",
          transactionReferenceCode: "order_2",
        },
      },
    ]);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      {
        url: "https://example.test/api/admin/customers/cust_1/payments?limit=20&offset=0",
      } as never,
      { params: { id: "cust_1" } }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.aggregates).toEqual(
      expect.objectContaining({
        disputeCount: 3,
        totalTransactions: 2,
      })
    );
    expect(payload.data[0]).toEqual(expect.objectContaining({ provider: "stripe" }));
    expect(payload.data[1]).toEqual(expect.objectContaining({ provider: "epos" }));
    expect(mockPrisma.integrationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              channel: "stripe",
              eventType: { contains: "charge.dispute" },
            },
            {
              channel: "epos",
              eventType: { contains: "dispute" },
            },
            {
              channel: "admin",
              eventType: { contains: "dispute" },
            },
          ],
        },
        select: {
          id: true,
          payload: true,
        },
      })
    );
  });
});
