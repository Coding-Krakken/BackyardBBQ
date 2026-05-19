/** @jest-environment node */

import { createHmac } from "node:crypto";
import { GrubhubClient } from "../grubhub-client";

jest.mock("../base-client", () => {
  const actual = jest.requireActual("../base-client");
  return {
    ...actual,
    performProviderRequest: jest.fn().mockResolvedValue(null)
  };
});

import { performProviderRequest } from "../base-client";

const mockedPerformProviderRequest = performProviderRequest as jest.MockedFunction<
  typeof performProviderRequest
>;

function makeCredentials(overrides: Record<string, string | undefined> = {}) {
  return {
    apiKey: "gh-key",
    webhookSecret: "gh-webhook-secret",
    storeId: "gh-store",
    environment: "sandbox" as const,
    ...overrides
  };
}

describe("GrubhubClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      GRUBHUB_API_BASE_URL: "https://api.grubhub.test"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("verifies valid webhook signatures", async () => {
    const body = '{"event":"order.created"}';
    const signature = createHmac("sha256", "gh-webhook-secret")
      .update(body, "utf8")
      .digest("hex");

    const client = new GrubhubClient(makeCredentials());
    await expect(
      client.verifyWebhookSignature({ rawBody: body, signature: `v1=${signature}` })
    ).resolves.toBe(true);
  });

  it("returns false for invalid webhook signatures", async () => {
    const client = new GrubhubClient(makeCredentials());
    await expect(
      client.verifyWebhookSignature({ rawBody: '{"event":"x"}', signature: "bad" })
    ).resolves.toBe(false);
  });

  it("parses inbound order and computes idempotency key", async () => {
    const client = new GrubhubClient(makeCredentials());
    await expect(client.parseInboundOrder({ id: "gh-1", totalCents: 1800 })).resolves.toEqual(
      expect.objectContaining({
        externalOrderId: "gh-1",
        idempotencyKey: "grubhub:gh-1",
        totalCents: 1800
      })
    );
  });

  it("uses externalOrderId and defaults totalCents to 0", async () => {
    const client = new GrubhubClient(makeCredentials());
    await expect(client.parseInboundOrder({ externalOrderId: "gh-2" })).resolves.toEqual(
      expect.objectContaining({
        externalOrderId: "gh-2",
        idempotencyKey: "grubhub:gh-2",
        totalCents: 0
      })
    );
  });

  it("throws when payload has no order identifier", async () => {
    const client = new GrubhubClient(makeCredentials());
    await expect(client.parseInboundOrder({})).rejects.toThrow(
      "Grubhub payload missing external order id"
    );
  });

  it("maps actions during sendOrderAction", async () => {
    const client = new GrubhubClient(makeCredentials());

    await client.sendOrderAction({
      externalOrderId: "gh-2",
      action: "ready",
      correlationId: "corr-gh",
      occurredAt: "2026-01-01T00:00:00Z"
    });

    expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
    expect(mockedPerformProviderRequest.mock.calls[0]?.[0]).toMatchObject({
      method: "POST",
      body: expect.objectContaining({ status: "ready" })
    });
  });

  it("dispatchOrder maps to accepted status sync", async () => {
    const client = new GrubhubClient(makeCredentials());

    await client.dispatchOrder({
      externalOrderId: "gh-dispatch-1",
      correlationId: "corr-gh-dispatch",
      priority: "normal",
      occurredAt: "2026-01-01T00:00:00Z"
    });

    expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
    expect(mockedPerformProviderRequest.mock.calls[0]?.[0]).toMatchObject({
      method: "POST",
      body: expect.objectContaining({ status: "confirmed" })
    });
  });

  it("short-circuits syncOrderStatus when credentials are incomplete", async () => {
    const client = new GrubhubClient(makeCredentials({ apiKey: "", storeId: undefined }));

    await client.syncOrderStatus({
      externalOrderId: "gh-sync-missing-creds",
      status: "accepted",
      occurredAt: "2026-01-01T00:00:00Z"
    });

    expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
  });

  it("syncs settlement when credentials are present", async () => {
    const client = new GrubhubClient(makeCredentials());

    await client.syncSettlement({
      externalOrderId: "gh-settle-1",
      settlementId: "gh-settle-id",
      grossCents: 5000,
      feesCents: 500,
      netCents: 4500,
      currency: "usd",
      settledAt: "2026-01-01T00:00:00Z"
    });

    expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
    expect(mockedPerformProviderRequest.mock.calls[0]?.[0].url).toContain("/settlements");
  });

  it("short-circuits syncSettlement when credentials are incomplete", async () => {
    const client = new GrubhubClient(makeCredentials({ apiKey: "", storeId: undefined }));

    await client.syncSettlement({
      externalOrderId: "gh-3",
      settlementId: "sett-1",
      grossCents: 1000,
      feesCents: 100,
      netCents: 900,
      currency: "usd",
      settledAt: "2026-01-01T00:00:00Z"
    });

    expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
  });

  it("publishes menu snapshot through grubhub endpoint", async () => {
    const client = new GrubhubClient(makeCredentials());

    await client.publishMenuSnapshot({
      locationId: "loc-1",
      publishedAt: "2026-01-01T00:00:00Z",
      items: [{ name: "Ribs", priceCents: 1999, available: true }]
    });

    expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
    expect(mockedPerformProviderRequest.mock.calls[0]?.[0].url).toContain("/restaurants/gh-store/menu");
  });

  it("short-circuits publishMenuSnapshot when credentials are incomplete", async () => {
    const client = new GrubhubClient(makeCredentials({ apiKey: "", storeId: undefined }));

    await client.publishMenuSnapshot({
      locationId: "loc-1",
      publishedAt: "2026-01-01T00:00:00Z",
      items: [{ name: "Ribs", priceCents: 1999, available: true }]
    });

    expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
  });

  it("returns unhealthy health status when api key is missing", async () => {
    const client = new GrubhubClient(makeCredentials({ apiKey: "" }));

    await expect(client.checkHealth()).resolves.toEqual({
      healthy: false,
      latencyMs: 0,
      reason: "Grubhub credentials not configured"
    });
  });

  it("returns degraded health when provider call fails", async () => {
    mockedPerformProviderRequest.mockRejectedValueOnce(new Error("timeout"));
    const client = new GrubhubClient(makeCredentials());

    const health = await client.checkHealth();
    expect(health.healthy).toBe(false);
    expect(health.reason).toBe("Grubhub health request failed");
  });

  it("uses simulated fallback latency when elapsed time is zero", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000);
    mockedPerformProviderRequest.mockRejectedValueOnce(new Error("timeout"));

    const client = new GrubhubClient(makeCredentials());
    const health = await client.checkHealth();

    expect(health.healthy).toBe(false);
    expect(health.latencyMs).toBe(220);
    expect(health.reason).toBe("Grubhub health request failed");

    nowSpy.mockRestore();
  });

  it("returns healthy status when health endpoint responds", async () => {
    const client = new GrubhubClient(makeCredentials());

    const health = await client.checkHealth();
    expect(health.healthy).toBe(true);
    expect(typeof health.latencyMs).toBe("number");
  });
});
