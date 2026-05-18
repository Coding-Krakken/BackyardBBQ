import { NextResponse } from "next/server";

const mockRequireAdmin = jest.fn();
const mockCheckDataIntegrity = jest.fn();

jest.mock("@/lib/requireAdmin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/financialMetrics", () => ({
  checkDataIntegrity: (...args: unknown[]) => mockCheckDataIntegrity(...args),
}));

describe("GET /api/admin/health/data-integrity", () => {
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;

  async function runGet() {
    const routeModule = await import("../route");
    return routeModule.GET();
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.DATA_INTEGRITY_ALERT_WEBHOOK_URL = "";
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    console.error = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  it("returns auth response when requireAdmin denies access", async () => {
    const nextServer = await import("next/server");
    mockRequireAdmin.mockResolvedValueOnce(
      nextServer.NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await runGet();

    expect(response.status).toBe(401);
    expect(mockCheckDataIntegrity).not.toHaveBeenCalled();
  });

  it("returns 200 with healthy payload", async () => {
    mockRequireAdmin.mockResolvedValueOnce({ role: "admin" });
    mockCheckDataIntegrity.mockResolvedValueOnce({
      healthy: true,
      ordersWithoutPayments: 0,
      paymentsWithoutOrders: 0,
      orderSumCents: 1000,
      paymentSumCents: 1000,
      sumDifferenceCents: 0,
    });

    const response = await runGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
  });

  it("returns 503 and sends webhook alert when unhealthy", async () => {
    process.env.DATA_INTEGRITY_ALERT_WEBHOOK_URL = "https://example.test/webhook";
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockCheckDataIntegrity.mockResolvedValue({
      healthy: false,
      ordersWithoutPayments: 1,
      paymentsWithoutOrders: 0,
      orderSumCents: 4802,
      paymentSumCents: 0,
      sumDifferenceCents: 4802,
      details: "1 orders without payment records; $48.02 discrepancy",
    });

    const response = await runGet();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.healthy).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("throttles alert webhook within cooldown window", async () => {
    process.env.DATA_INTEGRITY_ALERT_WEBHOOK_URL = "https://example.test/webhook";
    mockRequireAdmin.mockResolvedValue({ role: "admin" });
    mockCheckDataIntegrity.mockResolvedValue({
      healthy: false,
      ordersWithoutPayments: 1,
      paymentsWithoutOrders: 0,
      orderSumCents: 2000,
      paymentSumCents: 0,
      sumDifferenceCents: 2000,
      details: "integrity mismatch",
    });

    const first = await runGet();
    const second = await runGet();

    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when integrity check throws", async () => {
    mockRequireAdmin.mockResolvedValueOnce({ role: "admin" });
    mockCheckDataIntegrity.mockRejectedValueOnce(new Error("boom"));

    const response = await runGet();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.healthy).toBe(false);
    expect(body.error).toBe("Failed to run integrity check");
  });
});
