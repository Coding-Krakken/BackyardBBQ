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

describe("POST /api/admin/payments/disputes/[id]/evidence (EPOS)", () => {
  async function runPost(body: unknown) {
    const routeModule = await import("../route");
    return routeModule.POST(
      {
        headers: {
          get: () => "application/json",
        },
        json: async () => body,
      } as never,
      { params: { id: "evt_dispute_1" } }
    );
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.PAYMENT_PROVIDER = "epos";
  });

  it("records evidence for manual EPOS dispute handling", async () => {
    mockRequireAdmin.mockResolvedValue({ role: "accounting" });
    mockPrisma.integrationEvent.findUnique.mockResolvedValue({
      id: "evt_dispute_1",
      eventType: "epos.dispute.flagged",
      payload: {
        disputeId: "epos_case_1",
      },
    });
    mockPrisma.integrationEvent.update.mockResolvedValue({
      id: "evt_dispute_1",
      status: "evidence_submitted",
      payload: {
        disputeStatus: "evidence_submitted",
      },
    });

    const response = await runPost({
      uncategorizedText: "Customer confirms authorized transaction and delivery.",
      orderDetails: "Order #1201 delivered same day.",
      customerEmail: "guest@example.com",
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toContain("manual EPOS dispute handling");
    expect(mockPrisma.integrationEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_dispute_1" },
        data: expect.objectContaining({ status: "evidence_submitted" }),
      })
    );
  });
});
