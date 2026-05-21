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

describe("GET /api/admin/payments/ops-metrics", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("counts webhook events from stripe/epos and disputes from all channels", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });

    const stripeCreatedAt = new Date("2026-05-20T10:00:00.000Z");
    const eposCreatedAt = new Date("2026-05-20T10:05:00.000Z");

    mockPrisma.paymentTransaction.findMany.mockResolvedValue([
      { amountCents: 2000, status: "succeeded", createdAt: new Date("2026-05-20T09:00:00.000Z") },
      { amountCents: 1000, status: "refunded", createdAt: new Date("2026-05-20T09:30:00.000Z") },
    ]);

    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        channel: "stripe",
        eventType: "payment_intent.succeeded",
        payload: { updatedAt: Math.floor(stripeCreatedAt.getTime() / 1000) - 5 },
        createdAt: stripeCreatedAt,
      },
      {
        channel: "epos",
        eventType: "epos.transaction.completed",
        payload: { occurredAt: "2026-05-20T10:04:58.000Z" },
        createdAt: eposCreatedAt,
      },
      {
        channel: "admin",
        eventType: "admin.dispute.created",
        payload: {},
        createdAt: new Date("2026-05-20T10:06:00.000Z"),
      },
    ]);

    const routeModule = await import("../route");
    const response = await routeModule.GET({
      url: "https://example.test/api/admin/payments/ops-metrics?days=30",
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.kpis.webhookEvents).toBe(2);
    expect(payload.kpis.disputeCount).toBe(1);
    expect(payload.kpis.lastWebhookAt).toBe(eposCreatedAt.toISOString());
    expect(payload.kpis.averageWebhookLatencyMs).toBeGreaterThan(0);
  });

  it("caps metrics window to 90 days", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.paymentTransaction.findMany.mockResolvedValue([]);
    mockPrisma.integrationEvent.findMany.mockResolvedValue([]);

    const routeModule = await import("../route");
    const response = await routeModule.GET({
      url: "https://example.test/api/admin/payments/ops-metrics?days=365",
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.windowDays).toBe(90);
  });
});
