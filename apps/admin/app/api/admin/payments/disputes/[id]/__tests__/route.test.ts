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
    findUnique: jest.fn(),
  },
};

jest.mock("@/lib/requireAdmin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/admin/payments/disputes/[id]", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("returns provider-aware EPOS dispute details with normalized timestamps", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.integrationEvent.findUnique.mockResolvedValue({
      id: "evt_dispute_1",
      eventType: "epos.dispute.flagged",
      status: "evidence_submitted",
      createdAt: new Date("2026-05-20T10:00:00.000Z"),
      payload: {
        disputeId: "epos_case_1",
        paymentIntentId: "epos_txn_777",
        eposTransactionId: "777",
        amountCents: 8900,
        currency: "gbp",
        reason: "not_received",
        disputeStatus: "evidence_submitted",
        evidenceDueBy: 1771111111,
        updatedAt: "2026-06-15T09:00:00.000Z",
        evidence: { summary: "Delivery proof attached" },
      },
    });

    const routeModule = await import("../route");
    const response = await routeModule.GET({} as never, { params: { id: "evt_dispute_1" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual(
      expect.objectContaining({
        id: "evt_dispute_1",
        provider: "epos",
        eposTransactionId: "777",
        dueBy: new Date(1771111111 * 1000).toISOString(),
        updatedAt: "2026-06-15T09:00:00.000Z",
      })
    );
  });

  it("returns 404 when event is missing or not a dispute", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.integrationEvent.findUnique.mockResolvedValue({
      id: "evt_non_dispute",
      eventType: "admin.refund.issued",
      status: "recorded",
      createdAt: new Date(),
      payload: {},
    });

    const routeModule = await import("../route");
    const response = await routeModule.GET({} as never, { params: { id: "evt_non_dispute" } });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.message).toBe("Dispute event not found");
  });

  it("parses numeric string amount from payload", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.integrationEvent.findUnique.mockResolvedValue({
      id: "evt_dispute_3",
      eventType: "epos.dispute.flagged",
      status: "needs_response",
      createdAt: new Date("2026-05-20T10:00:00.000Z"),
      payload: {
        disputeId: "epos_case_3",
        amountCents: "2750",
      },
    });

    const routeModule = await import("../route");
    const response = await routeModule.GET({} as never, { params: { id: "evt_dispute_3" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual(
      expect.objectContaining({
        amountCents: 2750,
      })
    );
  });
});
