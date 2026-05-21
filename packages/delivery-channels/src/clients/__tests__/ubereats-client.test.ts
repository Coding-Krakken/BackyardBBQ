/** @jest-environment node */

import { createHmac } from "node:crypto";
import { UberEatsClient } from "../ubereats-client";

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
    apiKey: "uber-key",
    webhookSecret: "uber-webhook-secret",
    storeId: "uber-store",
    environment: "sandbox" as const,
    ...overrides
  };
}

describe("UberEatsClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      UBEREATS_API_BASE_URL: "https://api.uber.test"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("verifies valid webhook signatures", async () => {
    const body = '{"event":"order.created"}';
    const signature = createHmac("sha256", "uber-webhook-secret")
      .update(body, "utf8")
      .digest("hex");

    const client = new UberEatsClient(makeCredentials());
    await expect(
      client.verifyWebhookSignature({ rawBody: body, signature: `sha256=${signature}` })
    ).resolves.toBe(true);
  });

  it("returns false for invalid webhook signatures", async () => {
    const client = new UberEatsClient(makeCredentials());
    await expect(
      client.verifyWebhookSignature({ rawBody: '{"event":"x"}', signature: "deadbeef" })
    ).resolves.toBe(false);
  });

  it("parses inbound order and enforces idempotency key shape", async () => {
    const client = new UberEatsClient(makeCredentials());
    await expect(client.parseInboundOrder({ externalOrderId: "ue-1", totalCents: 2500 })).resolves.toEqual(
      expect.objectContaining({
        externalOrderId: "ue-1",
        idempotencyKey: "ubereats:ue-1",
        totalCents: 2500
      })
    );
  });

  it("defaults totalCents to 0 when omitted", async () => {
    const client = new UberEatsClient(makeCredentials());
    await expect(client.parseInboundOrder({ externalOrderId: "ue-2" })).resolves.toEqual(
      expect.objectContaining({
        externalOrderId: "ue-2",
        idempotencyKey: "ubereats:ue-2",
        totalCents: 0
      })
    );
  });

  it("throws when payload has no order identifier", async () => {
    const client = new UberEatsClient(makeCredentials());
    await expect(client.parseInboundOrder({})).rejects.toThrow(
      "UberEats payload missing external order id"
    );
  });

  it("maps action status for sendOrderAction", async () => {
    const client = new UberEatsClient(makeCredentials());

    await client.sendOrderAction({
      externalOrderId: "ue-2",
      action: "ready",
      correlationId: "corr-ue",
      occurredAt: "2026-01-01T00:00:00Z"
    });

    expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
    expect(mockedPerformProviderRequest.mock.calls[0]?.[0]).toMatchObject({
      method: "POST",
      body: expect.objectContaining({ status: "ready" })
    });
  });

  it("dispatchOrder maps to accepted status sync", async () => {
    const client = new UberEatsClient(makeCredentials());

    await client.dispatchOrder({
      externalOrderId: "ue-dispatch-1",
      correlationId: "corr-ue-dispatch",
      priority: "normal",
      occurredAt: "2026-01-01T00:00:00Z"
    });

    expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
    expect(mockedPerformProviderRequest.mock.calls[0]?.[0]).toMatchObject({
      method: "POST",
      body: expect.objectContaining({ status: "accepted" })
    });
  });

  it("syncs settlement when credentials are present", async () => {
    const client = new UberEatsClient(makeCredentials());

    await client.syncSettlement({
      externalOrderId: "ue-settle-1",
      settlementId: "ue-settle-id",
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
    const client = new UberEatsClient(makeCredentials({ apiKey: "", storeId: undefined }));

    await client.syncSettlement({
      externalOrderId: "ue-settle-missing-creds",
      settlementId: "ue-settle-id",
      grossCents: 5000,
      feesCents: 500,
      netCents: 4500,
      currency: "usd",
      settledAt: "2026-01-01T00:00:00Z"
    });

    expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
  });

  it("short-circuits syncOrderStatus when credentials are incomplete", async () => {
    const client = new UberEatsClient(makeCredentials({ apiKey: "", storeId: undefined }));

    await client.syncOrderStatus({
      externalOrderId: "ue-3",
      status: "accepted",
      occurredAt: "2026-01-01T00:00:00Z"
    });

    expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
  });

  it("publishes menu snapshot through provider endpoint", async () => {
    const client = new UberEatsClient(makeCredentials());

    await client.publishMenuSnapshot({
      locationId: "loc-1",
      publishedAt: "2026-01-01T00:00:00Z",
      items: [{ name: "Pulled Pork", priceCents: 1599, available: true }]
    });

    expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
    expect(mockedPerformProviderRequest.mock.calls[0]?.[0].url).toContain("/v1/eats/stores/uber-store/menus");
  });

  it("short-circuits publishMenuSnapshot when credentials are incomplete", async () => {
    const client = new UberEatsClient(makeCredentials({ apiKey: "", storeId: undefined }));

    await client.publishMenuSnapshot({
      locationId: "loc-1",
      publishedAt: "2026-01-01T00:00:00Z",
      items: [{ name: "Pulled Pork", priceCents: 1599, available: true }]
    });

    expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
  });

  it("returns unhealthy health status when api key is missing", async () => {
    const client = new UberEatsClient(makeCredentials({ apiKey: "" }));

    await expect(client.checkHealth()).resolves.toEqual({
      healthy: false,
      latencyMs: 0,
      reason: "UberEats credentials not configured"
    });
  });

  it("returns degraded health when provider call fails", async () => {
    mockedPerformProviderRequest.mockRejectedValueOnce(new Error("timeout"));
    const client = new UberEatsClient(makeCredentials());

    const health = await client.checkHealth();
    expect(health.healthy).toBe(false);
    expect(health.reason).toBe("UberEats health request failed");
  });

  it("returns healthy status when health endpoint responds", async () => {
    const client = new UberEatsClient(makeCredentials());

    const health = await client.checkHealth();
    expect(health.healthy).toBe(true);
    expect(typeof health.latencyMs).toBe("number");
  });
});
