import type { NextRequest } from "next/server";

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
  integrationEvent: {
    findMany: jest.fn(),
  },
  paymentTransaction: {
    findMany: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
  },
};

jest.mock("../../../../../../../lib/requireAdmin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("../../../../../../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/admin/integrations/correlation/[id]", () => {
  async function runGet(url: string, id: string) {
    const routeModule = await import("../route");
    return routeModule.GET({ url } as unknown as NextRequest, { params: { id } });
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("returns auth response when requireAdmin denies access", async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      MockNextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await runGet("http://localhost/api/admin/integrations/correlation/corr-1", "corr-1");

    expect(response.status).toBe(401);
    expect(mockPrisma.integrationEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns 400 when correlation ID is missing", async () => {
    mockRequireAdmin.mockResolvedValueOnce({ role: "admin" });

    const response = await runGet("http://localhost/api/admin/integrations/correlation/%20", " ");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: "Missing correlation ID" });
  });

  it("returns merged timeline including events, payments, and orders", async () => {
    mockRequireAdmin.mockResolvedValueOnce({ role: "admin" });
    mockPrisma.integrationEvent.findMany.mockResolvedValueOnce([
      {
        id: "evt-1",
        channel: "stripe",
        eventType: "payment_intent.succeeded",
        status: "processed",
        orderId: "ord-1",
        correlationId: "corr-1",
        createdAt: new Date("2026-05-19T10:00:00.000Z"),
        payload: {
          eventId: "evt_stripe_1",
          correlationId: "corr-1",
        },
      },
    ]);
    mockPrisma.paymentTransaction.findMany.mockResolvedValueOnce([
      {
        id: "pay-1",
        orderId: "ord-1",
        stripePaymentIntentId: "pi_123",
        amountCents: 4250,
        currency: "usd",
        status: "succeeded",
        paymentType: "order",
        correlationId: "corr-1",
        createdAt: new Date("2026-05-19T10:01:00.000Z"),
        updatedAt: new Date("2026-05-19T10:02:00.000Z"),
      },
    ]);
    mockPrisma.order.findMany.mockResolvedValueOnce([
      {
        id: "ord-1",
        source: "direct",
        status: "completed",
        externalChannel: null,
        externalOrderId: null,
        totalCents: 4250,
        correlationId: "corr-1",
        createdAt: new Date("2026-05-19T09:59:00.000Z"),
        updatedAt: new Date("2026-05-19T10:03:00.000Z"),
      },
    ]);

    const response = await runGet(
      "http://localhost/api/admin/integrations/correlation/corr-1?limit=100",
      "corr-1"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toMatchObject({
      total: 3,
      events: 1,
      payments: 1,
      orders: 1,
    });
    expect(body.data).toHaveLength(1);
    expect(body.payments).toHaveLength(1);
    expect(body.orders).toHaveLength(1);
    expect(body.timeline).toHaveLength(3);
    expect(body.timeline[0]).toMatchObject({ type: "order", id: "ord-1" });
    expect(body.timeline[1]).toMatchObject({ type: "event", id: "evt-1" });
    expect(body.timeline[2]).toMatchObject({ type: "payment", id: "pay-1" });
  });
});
