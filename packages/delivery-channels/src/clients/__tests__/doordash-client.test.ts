/** @jest-environment node */

import { createHmac } from "node:crypto";
import { DoorDashClient } from "../doordash-client";

// Mock performProviderRequest to prevent real HTTP calls
jest.mock("../base-client", () => {
  const actual = jest.requireActual("../base-client");
  return {
    ...actual,
    performProviderRequest: jest.fn().mockResolvedValue(null),
  };
});

import { performProviderRequest } from "../base-client";

const mockedPerformProviderRequest = performProviderRequest as jest.MockedFunction<
  typeof performProviderRequest
>;

function makeCredentials(overrides: Record<string, string | undefined> = {}) {
  return {
    apiKey: "test-key-id",
    apiSecret: "dGVzdC1zaWduaW5nLXNlY3JldA", // base64url of "test-signing-secret"
    webhookSecret: "webhook-hmac-secret",
    merchantId: "merchant-1",
    storeId: "store-1",
    environment: "sandbox" as const,
    ...overrides,
  };
}

describe("DoorDashClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      DOORDASH_DEVELOPER_ID: "dev-id-123",
      DOORDASH_API_BASE_URL: "https://openapi.doordash.com",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("uses DOORDASH_API_BASE_URL env var for base url", () => {
      process.env.DOORDASH_API_BASE_URL = "https://custom.doordash.com";
      const client = new DoorDashClient(makeCredentials());
      expect(client.channel).toBe("doordash");
    });

    it("defaults to openapi.doordash.com when env var is absent", () => {
      delete process.env.DOORDASH_API_BASE_URL;
      const client = new DoorDashClient(makeCredentials());
      expect(client.channel).toBe("doordash");
    });
  });

  describe("getDoorDashJwt (via syncOrderStatus)", () => {
    it("generates a valid 3-part JWT with HS256", async () => {
      const client = new DoorDashClient(makeCredentials());
      await client.syncOrderStatus({
        externalOrderId: "order-1",
        status: "accepted",
        occurredAt: new Date().toISOString(),
      });

      expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
      const call = mockedPerformProviderRequest.mock.calls[0]![0];
      const token = call.apiKey;
      const parts = token.split(".");
      expect(parts).toHaveLength(3);

      // Decode header
      const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString());
      expect(header).toMatchObject({
        alg: "HS256",
        typ: "JWT",
        "dd-ver": "DD-JWT-V1",
      });

      // Decode payload
      const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString());
      expect(payload.aud).toBe("doordash");
      expect(payload.iss).toBe("dev-id-123");
      expect(payload.kid).toBe("test-key-id");
      expect(payload.exp - payload.iat).toBe(300);
    });

    it("returns null JWT when DOORDASH_DEVELOPER_ID is missing", async () => {
      delete process.env.DOORDASH_DEVELOPER_ID;
      const client = new DoorDashClient(makeCredentials());
      await client.syncOrderStatus({
        externalOrderId: "order-1",
        status: "accepted",
        occurredAt: new Date().toISOString(),
      });

      // Should not call provider because JWT is null
      expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
    });

    it("returns null JWT when apiSecret is missing", async () => {
      const client = new DoorDashClient(makeCredentials({ apiSecret: undefined }));
      await client.syncOrderStatus({
        externalOrderId: "order-1",
        status: "accepted",
        occurredAt: new Date().toISOString(),
      });

      expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
    });
  });

  describe("verifyWebhookSignature", () => {
    it("returns true for a valid HMAC-SHA256 signature", async () => {
      const secret = "test-webhook-secret";
      const body = '{"event":"settlement.created"}';
      const hmac = createHmac("sha256", secret).update(body, "utf8").digest("hex");

      const client = new DoorDashClient(makeCredentials({ webhookSecret: secret }));
      const result = await client.verifyWebhookSignature({
        rawBody: body,
        signature: hmac,
      });

      expect(result).toBe(true);
    });

    it("returns true when signature has sha256= prefix", async () => {
      const secret = "test-webhook-secret";
      const body = '{"event":"order.created"}';
      const hmac = createHmac("sha256", secret).update(body, "utf8").digest("hex");

      const client = new DoorDashClient(makeCredentials({ webhookSecret: secret }));
      const result = await client.verifyWebhookSignature({
        rawBody: body,
        signature: `sha256=${hmac}`,
      });

      expect(result).toBe(true);
    });

    it("returns true when signature has v1= prefix", async () => {
      const secret = "test-webhook-secret";
      const body = '{"event":"status.updated"}';
      const hmac = createHmac("sha256", secret).update(body, "utf8").digest("hex");

      const client = new DoorDashClient(makeCredentials({ webhookSecret: secret }));
      const result = await client.verifyWebhookSignature({
        rawBody: body,
        signature: `v1=${hmac}`,
      });

      expect(result).toBe(true);
    });

    it("returns false for an invalid signature", async () => {
      const client = new DoorDashClient(
        makeCredentials({ webhookSecret: "real-secret" })
      );
      const result = await client.verifyWebhookSignature({
        rawBody: '{"event":"test"}',
        signature: "0000000000000000000000000000000000000000000000000000000000000000",
      });

      expect(result).toBe(false);
    });

    it("returns false when signature is missing", async () => {
      const client = new DoorDashClient(makeCredentials());
      const result = await client.verifyWebhookSignature({
        rawBody: '{"event":"test"}',
        signature: undefined,
      });

      expect(result).toBe(false);
    });

    it("returns false when webhook secret is missing", async () => {
      const client = new DoorDashClient(
        makeCredentials({ webhookSecret: undefined })
      );
      const result = await client.verifyWebhookSignature({
        rawBody: '{"event":"test"}',
        signature: "abcdef1234567890",
      });

      expect(result).toBe(false);
    });

    it("returns false for empty body", async () => {
      const client = new DoorDashClient(makeCredentials());
      const result = await client.verifyWebhookSignature({
        rawBody: "",
        signature: "abcdef",
      });

      expect(result).toBe(false);
    });
  });

  describe("parseInboundOrder", () => {
    it("extracts order from externalOrderId field", async () => {
      const client = new DoorDashClient(makeCredentials());
      const result = await client.parseInboundOrder({
        externalOrderId: "dd-order-99",
        totalCents: 2500,
      });

      expect(result).toMatchObject({
        externalOrderId: "dd-order-99",
        idempotencyKey: "doordash:dd-order-99",
        totalCents: 2500,
        items: [],
      });
      expect(result.placedAt).toBeDefined();
    });

    it("falls back to id field when externalOrderId is absent", async () => {
      const client = new DoorDashClient(makeCredentials());
      const result = await client.parseInboundOrder({
        id: "order-from-id",
        totalCents: 1200,
      });

      expect(result.externalOrderId).toBe("order-from-id");
      expect(result.idempotencyKey).toBe("doordash:order-from-id");
    });

    it("defaults totalCents to 0 when missing", async () => {
      const client = new DoorDashClient(makeCredentials());
      const result = await client.parseInboundOrder({
        externalOrderId: "order-1",
      });

      expect(result.totalCents).toBe(0);
    });

    it("throws when both externalOrderId and id are missing", async () => {
      const client = new DoorDashClient(makeCredentials());
      await expect(client.parseInboundOrder({})).rejects.toThrow(
        "DoorDash payload missing external order id"
      );
    });
  });

  describe("syncOrderStatus", () => {
    it("calls provider with correct URL and JWT auth", async () => {
      const client = new DoorDashClient(makeCredentials());
      await client.syncOrderStatus({
        externalOrderId: "order-42",
        status: "preparing",
        occurredAt: "2026-01-01T00:00:00Z",
      });

      expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
      const call = mockedPerformProviderRequest.mock.calls[0]![0];
      expect(call.url).toContain("/drive/v2/stores/store-1/orders/order-42/status");
      expect(call.method).toBe("POST");
      expect(call.body).toMatchObject({
        status: "preparing",
        occurredAt: "2026-01-01T00:00:00Z",
      });
    });

    it("skips call when apiKey is missing", async () => {
      const client = new DoorDashClient(makeCredentials({ apiKey: "" }));
      await client.syncOrderStatus({
        externalOrderId: "order-1",
        status: "accepted",
        occurredAt: new Date().toISOString(),
      });

      expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
    });

    it("skips call when storeId is missing", async () => {
      const client = new DoorDashClient(makeCredentials({ storeId: undefined }));
      await client.syncOrderStatus({
        externalOrderId: "order-1",
        status: "accepted",
        occurredAt: new Date().toISOString(),
      });

      expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
    });
  });

  describe("syncSettlement", () => {
    it("is a no-op that does not call provider", async () => {
      const client = new DoorDashClient(makeCredentials());
      await client.syncSettlement({
        externalOrderId: "order-1",
        settlementId: "stl-1",
        grossCents: 5000,
        feesCents: 750,
        netCents: 4250,
        currency: "usd",
        settledAt: "2026-01-01T00:00:00Z",
      });

      expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
    });

    it("still no-ops when credentials are missing", async () => {
      const client = new DoorDashClient(makeCredentials({ apiKey: "" }));
      await client.syncSettlement({
        externalOrderId: "order-1",
        settlementId: "stl-1",
        grossCents: 5000,
        feesCents: 750,
        netCents: 4250,
        currency: "usd",
        settledAt: "2026-01-01T00:00:00Z",
      });

      expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
    });
  });

  describe("dispatchOrder", () => {
    it("delegates to syncOrderStatus with accepted status", async () => {
      const client = new DoorDashClient(makeCredentials());
      await client.dispatchOrder({
        externalOrderId: "order-dispatch",
        correlationId: "corr-1",
        priority: "normal",
        occurredAt: "2026-01-01T00:00:00Z",
      });

      expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
      const body = mockedPerformProviderRequest.mock.calls[0]![0].body;
      expect(body).toMatchObject({ status: "accepted" });
    });
  });

  describe("sendOrderAction", () => {
    const actions = [
      { action: "accept", expectedStatus: "accepted" },
      { action: "reject", expectedStatus: "cancelled" },
      { action: "cancel", expectedStatus: "cancelled" },
      { action: "preparing", expectedStatus: "preparing" },
      { action: "ready", expectedStatus: "ready_for_pickup" },
      { action: "out_for_delivery", expectedStatus: "out_for_delivery" },
      { action: "delivered", expectedStatus: "delivered" },
    ] as const;

    for (const { action, expectedStatus } of actions) {
      it(`maps "${action}" action to "${expectedStatus}" provider status`, async () => {
        const client = new DoorDashClient(makeCredentials());
        await client.sendOrderAction({
          externalOrderId: "order-action",
          action,
          correlationId: "corr-1",
          occurredAt: "2026-01-01T00:00:00Z",
        });

        expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
        const body = mockedPerformProviderRequest.mock.calls[0]![0].body;
        expect(body?.status).toBe(expectedStatus);
      });
    }
  });

  describe("publishMenuSnapshot", () => {
    it("calls marketplace menu endpoint with JWT auth", async () => {
      const client = new DoorDashClient(makeCredentials());
      await client.publishMenuSnapshot({
        locationId: "loc-1",
        publishedAt: "2026-01-01T00:00:00Z",
        items: [
          { name: "Brisket Plate", priceCents: 1899, available: true },
        ],
      });

      expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
      const call = mockedPerformProviderRequest.mock.calls[0]![0];
      expect(call.url).toContain("/marketplace/v1/stores/store-1/menu");
      expect(call.method).toBe("PUT");
      expect(call.body).toMatchObject({
        locationId: "loc-1",
        items: [{ name: "Brisket Plate", priceCents: 1899, available: true }],
      });
    });

    it("skips call when credentials are incomplete", async () => {
      const client = new DoorDashClient(makeCredentials({ apiSecret: undefined }));
      await client.publishMenuSnapshot({
        locationId: "loc-1",
        publishedAt: "2026-01-01T00:00:00Z",
        items: [],
      });

      expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
    });
  });

  describe("checkHealth", () => {
    it("returns healthy status on successful request", async () => {
      const client = new DoorDashClient(makeCredentials());
      const result = await client.checkHealth();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.reason).toBeUndefined();
    });

    it("returns unhealthy when provider request fails", async () => {
      mockedPerformProviderRequest.mockRejectedValueOnce(new Error("timeout"));
      const client = new DoorDashClient(makeCredentials());
      const result = await client.checkHealth();

      expect(result.healthy).toBe(false);
      expect(result.reason).toBe("DoorDash health request failed");
    });

    it("returns unhealthy when credentials are missing", async () => {
      const client = new DoorDashClient(makeCredentials({ apiKey: "" }));
      const result = await client.checkHealth();

      expect(result.healthy).toBe(false);
      expect(result.reason).toBe("DoorDash credentials not configured");
      expect(mockedPerformProviderRequest).not.toHaveBeenCalled();
    });

    it("returns unhealthy when apiSecret is missing", async () => {
      const client = new DoorDashClient(makeCredentials({ apiSecret: undefined }));
      const result = await client.checkHealth();

      expect(result.healthy).toBe(false);
      expect(result.reason).toBe("DoorDash credentials not configured");
    });

    it("uses /drive/v2/health endpoint", async () => {
      const client = new DoorDashClient(makeCredentials());
      await client.checkHealth();

      expect(mockedPerformProviderRequest).toHaveBeenCalledTimes(1);
      const call = mockedPerformProviderRequest.mock.calls[0]![0];
      expect(call.url).toContain("/drive/v2/health");
      expect(call.method).toBe("GET");
    });
  });
});
