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

describe("GET /api/admin/payments/disputes", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("returns epos provider and normalizes epoch due date", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "evt_dispute_1",
        eventType: "epos.dispute.flagged",
        status: "needs_response",
        payload: {
          disputeId: "epos_case_11",
          paymentIntentId: "epos_txn_9001",
          eposTransactionId: "9001",
          amountCents: 4200,
          reason: "fraudulent",
          disputeStatus: "needs_response",
          evidenceDueBy: 1770000000,
        },
        createdAt: new Date("2026-05-20T10:00:00.000Z"),
      },
    ]);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      {
        url: "https://example.test/api/admin/payments/disputes?limit=20&offset=0",
      } as never
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        id: "evt_dispute_1",
        provider: "epos",
        eposTransactionId: "9001",
        dueBy: new Date(1770000000 * 1000).toISOString(),
      })
    );
  });

  it("falls back to epos provider for generic dispute events", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "evt_dispute_2",
        eventType: "charge.dispute.created",
        status: "under_review",
        payload: {
          disputeId: "dp_123",
          paymentIntentId: "pi_123",
          amountCents: 2500,
          reason: "duplicate",
          evidenceDueBy: "2026-07-01T12:00:00.000Z",
        },
        createdAt: new Date("2026-05-20T11:00:00.000Z"),
      },
    ]);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      {
        url: "https://example.test/api/admin/payments/disputes",
      } as never
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        provider: "epos",
        dueBy: "2026-07-01T12:00:00.000Z",
      })
    );
  });

  it("parses numeric string amount and millisecond epoch due date", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "evt_dispute_3",
        eventType: "epos.dispute.flagged",
        status: "needs_response",
        payload: {
          disputeId: "epos_case_12",
          paymentIntentId: "epos_txn_9012",
          amountCents: "3600",
          evidenceDueBy: "1770000000000",
        },
        createdAt: new Date("2026-05-20T12:00:00.000Z"),
      },
    ]);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      {
        url: "https://example.test/api/admin/payments/disputes",
      } as never
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        amountCents: 3600,
        dueBy: new Date(1770000000000).toISOString(),
      })
    );
  });

  it("infers EPOS provider and transaction id from epos_txn payment reference", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "evt_dispute_4",
        eventType: "charge.dispute.created",
        status: "needs_response",
        payload: {
          disputeId: "dp_epos_44",
          paymentIntentId: "epos_txn_4455",
          amountCents: 1900,
        },
        createdAt: new Date("2026-05-20T13:00:00.000Z"),
      },
    ]);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      {
        url: "https://example.test/api/admin/payments/disputes",
      } as never
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        provider: "epos",
        eposTransactionId: "4455",
      })
    );
  });
});
