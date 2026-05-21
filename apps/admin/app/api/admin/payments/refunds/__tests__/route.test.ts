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
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  integrationEvent: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock("@/lib/requireAdmin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("POST /api/admin/payments/refunds", () => {
  async function runPost(body: unknown) {
    const routeModule = await import("../route");
    return routeModule.POST({ json: async () => body } as never);
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("queues manual request when PAYMENT_PROVIDER is epos", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: "ptx_1",
      orderId: "ord_1",
      amountCents: 4200,
      stripePaymentIntentId: "epos_txn_222",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
    mockPrisma.integrationEvent.create.mockResolvedValue({ id: "evt_1" });

    const response = await runPost({ paymentIntentId: "epos_txn_222", amountCents: 1200 });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toEqual(
      expect.objectContaining({
        requestId: "evt_1",
        status: "pending_manual",
        paymentIntentId: "epos_txn_222",
        amountCents: 1200,
      })
    );
    expect(mockPrisma.paymentTransaction.update).not.toHaveBeenCalled();
  });

  it("accepts numeric-string amountCents in EPOS mode", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: "ptx_1",
      orderId: "ord_1",
      amountCents: 4200,
      stripePaymentIntentId: "epos_txn_222",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
    mockPrisma.integrationEvent.create.mockResolvedValue({ id: "evt_1" });

    const response = await runPost({ paymentIntentId: "epos_txn_222", amountCents: "1200" });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.amountCents).toBe(1200);
    expect(mockPrisma.integrationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            requestedAmountCents: 1200,
          }),
        }),
      })
    );
  });

  it("rejects invalid amountCents strings instead of defaulting to full refund", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });

    const response = await runPost({ paymentIntentId: "epos_txn_222", amountCents: "abc" });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("amountCents must be a positive integer");
    expect(mockPrisma.paymentTransaction.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });

  it("accepts raw EPOS transaction ids and resolves prefixed records", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: "ptx_raw",
      orderId: "ord_raw",
      amountCents: 5000,
      stripePaymentIntentId: "epos_txn_333",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
    mockPrisma.integrationEvent.create.mockResolvedValue({ id: "evt_raw" });

    const response = await runPost({ paymentIntentId: "333", amountCents: 1000 });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.requestId).toBe("evt_raw");
    expect(mockPrisma.paymentTransaction.findFirst).toHaveBeenCalledWith({
      where: {
        stripePaymentIntentId: {
          in: ["333", "epos_txn_333"],
        },
      },
    });
    expect(mockPrisma.integrationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            eposTransactionId: "333",
          }),
        }),
      })
    );
  });

  it("queues EPOS refund for payment intent lookup by piId", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: "ptx_2",
      orderId: "ord_2",
      amountCents: 5000,
      stripePaymentIntentId: "pi_123",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
    mockPrisma.integrationEvent.create.mockResolvedValue({ id: "evt_pi" });

    const response = await runPost({ paymentIntentId: "pi_123", amountCents: 1000 });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.requestId).toBe("evt_pi");
  });

  it("rejects EPOS refunds that exceed remaining refundable balance", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: "ptx_3",
      orderId: "ord_3",
      amountCents: 5000,
      stripePaymentIntentId: "epos_txn_333",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        eventType: "admin.payment_refund_requested",
        payload: {
          transactionId: "ptx_3",
          paymentIntentId: "epos_txn_333",
          requestedAmountCents: 4600,
        },
      },
    ]);

    const response = await runPost({ paymentIntentId: "epos_txn_333", amountCents: 700 });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Refund amount exceeds remaining refundable balance");
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });

  it("rejects EPOS refunds when no refundable balance remains", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: "ptx_4",
      orderId: "ord_4",
      amountCents: 3000,
      stripePaymentIntentId: "epos_txn_444",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        eventType: "admin.payment_refund_requested",
        payload: {
          transactionId: "ptx_4",
          paymentIntentId: "epos_txn_444",
          requestedAmountCents: 3000,
        },
      },
    ]);

    const response = await runPost({ paymentIntentId: "epos_txn_444", amountCents: 100 });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("No refundable balance remains");
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });

  it("counts historical refunds matched by raw/prefixed payment reference aliases", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: "ptx_5",
      orderId: "ord_5",
      amountCents: 5000,
      stripePaymentIntentId: "epos_txn_555",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        eventType: "admin.payment_refund_created",
        payload: {
          paymentIntentId: "555",
          refundAmountCents: 4900,
        },
      },
    ]);

    const response = await runPost({ paymentIntentId: "epos_txn_555", amountCents: 200 });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Refund amount exceeds remaining refundable balance");
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });

  it("counts historical refunds matched by stripePaymentIntentId aliases", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: "ptx_6",
      orderId: "ord_6",
      amountCents: 5000,
      stripePaymentIntentId: "epos_txn_666",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        eventType: "admin.payment_refund_created",
        payload: {
          stripePaymentIntentId: "666",
          refundAmountCents: 4900,
        },
      },
    ]);

    const response = await runPost({ paymentIntentId: "epos_txn_666", amountCents: 200 });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Refund amount exceeds remaining refundable balance");
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });
});
