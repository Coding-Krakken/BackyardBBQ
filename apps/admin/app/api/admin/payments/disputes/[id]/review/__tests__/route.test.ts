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
    update: jest.fn(),
  },
};

jest.mock("@/lib/requireAdmin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("PATCH /api/admin/payments/disputes/[id]/review", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("rejects non-dispute events", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.integrationEvent.findUnique.mockResolvedValue({
      id: "evt_1",
      eventType: "admin.refund.manual_requested",
      payload: {},
    });

    const routeModule = await import("../route");
    const response = await routeModule.PATCH({} as never, { params: { id: "evt_1" } });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Event is not a dispute");
    expect(mockPrisma.integrationEvent.update).not.toHaveBeenCalled();
  });

  it("writes reviewed status into both row status and payload", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockPrisma.integrationEvent.findUnique.mockResolvedValue({
      id: "evt_2",
      eventType: "epos.dispute.flagged",
      payload: { disputeStatus: "needs_response" },
    });
    mockPrisma.integrationEvent.update.mockResolvedValue({
      id: "evt_2",
      status: "reviewed",
    });

    const routeModule = await import("../route");
    const response = await routeModule.PATCH({} as never, { params: { id: "evt_2" } });

    expect(response.status).toBe(200);
    expect(mockPrisma.integrationEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_2" },
        data: expect.objectContaining({
          status: "reviewed",
          payload: expect.objectContaining({
            disputeStatus: "reviewed",
            reviewedAt: expect.any(String),
          }),
        }),
      })
    );
  });
});
