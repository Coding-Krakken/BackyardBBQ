/** @jest-environment node */

import { createDeliveryChannelAdapters } from "../../index";

// Mock performProviderRequest to prevent real HTTP calls
jest.mock("../base-client", () => {
  const actual = jest.requireActual("../base-client");
  return {
    ...actual,
    performProviderRequest: jest.fn().mockResolvedValue(null),
  };
});

const testCredentials = {
  doordash: {
    apiKey: "dd-key",
    apiSecret: "dd-secret",
    webhookSecret: "dd-webhook-secret",
    merchantId: "dd-merchant",
    storeId: "dd-store",
    environment: "sandbox" as const,
  },
  ubereats: { apiKey: "ue-key", webhookSecret: "ue-webhook-secret", storeId: "ue-store" },
  grubhub: { apiKey: "gh-key", webhookSecret: "gh-webhook-secret", storeId: "gh-store" },
};

describe("createDeliveryChannelAdapters", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, DOORDASH_DEVELOPER_ID: "dev-123" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("creates adapters for all three channels", () => {
    const adapters = createDeliveryChannelAdapters({
      credentialsByChannel: testCredentials,
    });

    expect(adapters.doordash).toBeDefined();
    expect(adapters.ubereats).toBeDefined();
    expect(adapters.grubhub).toBeDefined();
    expect(adapters.doordash.channel).toBe("doordash");
    expect(adapters.ubereats.channel).toBe("ubereats");
    expect(adapters.grubhub.channel).toBe("grubhub");
  });

  it("creates adapters with empty credentials when none provided", () => {
    const adapters = createDeliveryChannelAdapters();
    expect(adapters.doordash.channel).toBe("doordash");
  });

  describe("ingestOrder idempotency", () => {
    it("marks duplicate on second ingest of same order", async () => {
      const adapters = createDeliveryChannelAdapters({
        credentialsByChannel: testCredentials,
      });

      const envelope = {
        channel: "doordash" as const,
        externalOrderId: "order-idem-1",
        idempotencyKey: "doordash:order-idem-1",
        totalCents: 3000,
        placedAt: new Date().toISOString(),
        items: [],
      };

      const first = await adapters.doordash.ingestOrder(envelope);
      const second = await adapters.doordash.ingestOrder(envelope);

      expect(["processed", "terminal_failure", "retry_exhausted"]).toContain(
        first.status
      );
      expect(second.status).toBe("duplicate");
    });
  });

  describe("syncSettlement", () => {
    it("returns latencyMs from settlement sync", async () => {
      const adapters = createDeliveryChannelAdapters({
        credentialsByChannel: testCredentials,
      });

      const result = await adapters.doordash.syncSettlement({
        externalOrderId: "order-1",
        settlementId: "stl-1",
        grossCents: 5000,
        feesCents: 750,
        netCents: 4250,
        currency: "usd",
        settledAt: "2026-01-01T00:00:00Z",
      });

      expect(result).toHaveProperty("latencyMs");
      expect(typeof result.latencyMs).toBe("number");
    });
  });

  describe("checkHealth", () => {
    it("returns health snapshot with latency", async () => {
      const adapters = createDeliveryChannelAdapters({
        credentialsByChannel: testCredentials,
      });

      const result = await adapters.doordash.checkHealth();
      expect(result).toHaveProperty("healthy");
      expect(result).toHaveProperty("latencyMs");
    });
  });
});
