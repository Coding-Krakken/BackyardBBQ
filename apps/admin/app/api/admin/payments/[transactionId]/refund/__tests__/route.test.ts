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
  },
  integrationEvent: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock("@/lib/requireAdmin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("POST /api/admin/payments/[transactionId]/refund (EPOS)", () => {
  async function runPost(body: unknown) {
    const routeModule = await import("../route");
    return routeModule.POST(
      {
        json: async () => body,
      } as never,
      { params: { transactionId: "ptx_1" } }
    );
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.PAYMENT_PROVIDER = "epos";
  });

  it("queues a manual EPOS refund request", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.paymentTransaction.findUnique.mockResolvedValue({
      id: "ptx_1",
      orderId: "ord_1",
      amountCents: 5000,
      status: "succeeded",
      stripePaymentIntentId: "epos_txn_1234",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
    mockPrisma.integrationEvent.create.mockResolvedValue({ id: "evt_manual_1" });

    const response = await runPost({ amountCents: 1200, reason: "requested_by_customer" });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.refund).toEqual(
      expect.objectContaining({
        amountCents: 1200,
        status: "pending_manual",
        requestId: "evt_manual_1",
        provider: "epos",
      })
    );
    expect(payload.message).toContain("manual processing");
    expect(mockPrisma.integrationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            stripePaymentIntentId: "epos_txn_1234",
            eposTransactionId: "1234",
          }),
        }),
      })
    );
  });

  it("preserves raw EPOS transaction references in manual refund payload", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.paymentTransaction.findUnique.mockResolvedValue({
      id: "ptx_1",
      orderId: "ord_1",
      amountCents: 5000,
      status: "succeeded",
      stripePaymentIntentId: "1234",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
    mockPrisma.integrationEvent.create.mockResolvedValue({ id: "evt_manual_2" });

    const response = await runPost({ amountCents: 1000, reason: "requested_by_customer" });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.refund).toEqual(
      expect.objectContaining({
        amountCents: 1000,
        status: "pending_manual",
        requestId: "evt_manual_2",
        provider: "epos",
      })
    );
    expect(mockPrisma.integrationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            stripePaymentIntentId: "1234",
            eposTransactionId: "1234",
          }),
        }),
      })
    );
  });

  it("accepts numeric-string amountCents in EPOS mode", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.paymentTransaction.findUnique.mockResolvedValue({
      id: "ptx_1",
      orderId: "ord_1",
      amountCents: 5000,
      status: "succeeded",
      stripePaymentIntentId: "epos_txn_1234",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
    mockPrisma.integrationEvent.create.mockResolvedValue({ id: "evt_manual_3" });

    const response = await runPost({ amountCents: "1300", reason: "requested_by_customer" });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.refund).toEqual(
      expect.objectContaining({
        amountCents: 1300,
        status: "pending_manual",
        requestId: "evt_manual_3",
      })
    );
    expect(mockPrisma.integrationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            requestedAmountCents: 1300,
          }),
        }),
      })
    );
  });

  it("rejects invalid amountCents strings before querying transactions", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });

    const response = await runPost({ amountCents: "abc", reason: "requested_by_customer" });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Invalid refund payload");
    expect(mockPrisma.paymentTransaction.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });

  it("rejects refund amounts that exceed remaining refundable balance", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.paymentTransaction.findUnique.mockResolvedValue({
      id: "ptx_1",
      orderId: "ord_1",
      amountCents: 5000,
      status: "succeeded",
      stripePaymentIntentId: "epos_txn_1234",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        eventType: "admin.refund.manual_requested",
        payload: {
          transactionId: "ptx_1",
          requestedAmountCents: 4500,
        },
      },
    ]);

    const response = await runPost({ amountCents: 1000, reason: "requested_by_customer" });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Refund amount exceeds transaction amount");
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });

  it("counts numeric string refund history amounts when calculating remaining balance", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.paymentTransaction.findUnique.mockResolvedValue({
      id: "ptx_1",
      orderId: "ord_1",
      amountCents: 5000,
      status: "succeeded",
      stripePaymentIntentId: "epos_txn_1234",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        eventType: "admin.payment_refund_created",
        payload: {
          transactionId: "ptx_1",
          refundAmountCents: "4900",
        },
      },
    ]);

    const response = await runPost({ amountCents: 200, reason: "requested_by_customer" });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Refund amount exceeds transaction amount");
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });

  it("counts historical refunds matched by payment reference aliases", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.paymentTransaction.findUnique.mockResolvedValue({
      id: "ptx_1",
      orderId: "ord_1",
      amountCents: 5000,
      status: "succeeded",
      stripePaymentIntentId: "epos_txn_1234",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        eventType: "admin.payment_refund_created",
        payload: {
          paymentIntentId: "1234",
          requestedAmountCents: 4900,
        },
      },
    ]);

    const response = await runPost({ amountCents: 200, reason: "requested_by_customer" });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Refund amount exceeds transaction amount");
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });

  it("counts historical refunds matched by stripePaymentIntentId aliases", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.paymentTransaction.findUnique.mockResolvedValue({
      id: "ptx_1",
      orderId: "ord_1",
      amountCents: 5000,
      status: "succeeded",
      stripePaymentIntentId: "epos_txn_1234",
    });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        eventType: "admin.payment_refund_created",
        payload: {
          stripePaymentIntentId: "1234",
          refundAmountCents: 4900,
        },
      },
    ]);

    const response = await runPost({ amountCents: 200, reason: "requested_by_customer" });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Refund amount exceeds transaction amount");
    expect(mockPrisma.integrationEvent.create).not.toHaveBeenCalled();
  });
});
