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

    it("can return terminal_failure and retry_exhausted outcomes", async () => {
      const maxAttempts = 3;

      let terminalResult: { status: string } | null = null;
      let retryExhaustedResult: { status: string } | null = null;

      for (let index = 0; index < 400; index += 1) {
        const adapters = createDeliveryChannelAdapters({
          credentialsByChannel: testCredentials,
          retryPolicy: {
            maxAttempts,
          },
        });

        const envelope = {
          channel: "doordash" as const,
          externalOrderId: `order-outcome-${index}`,
          idempotencyKey: `doordash:order-outcome-${index}`,
          totalCents: 3000,
          placedAt: new Date().toISOString(),
          items: [],
        };

        const result = await adapters.doordash.ingestOrder(envelope);

        if (result.status === "terminal_failure") {
          terminalResult = result;
        }

        if (result.status === "retry_exhausted") {
          retryExhaustedResult = result;
        }

        if (terminalResult && retryExhaustedResult) {
          break;
        }
      }

      expect(terminalResult?.status).toBe("terminal_failure");
      expect(retryExhaustedResult?.status).toBe("retry_exhausted");
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

    it("proxies provider operations for dispatch/action/status/menu/webhook", async () => {
      const adapters = createDeliveryChannelAdapters({
        credentialsByChannel: testCredentials,
      });

      const webhookValid = await adapters.doordash.verifyWebhookSignature({
        rawBody: "{}",
        signature: "invalid-signature",
      });

      const dispatch = await adapters.doordash.dispatchOrder({
        externalOrderId: "dispatch-1",
        internalOrderId: "internal-1",
      } as any);
      const action = await adapters.doordash.sendOrderAction({
        externalOrderId: "dispatch-1",
        action: "confirm",
      } as any);
      const status = await adapters.doordash.syncOrderStatus({
        externalOrderId: "dispatch-1",
      } as any);
      const menu = await adapters.doordash.publishMenuSnapshot({
        channel: "doordash",
        snapshotVersion: "v1",
        updatedAt: new Date().toISOString(),
        menu: [],
      } as any);

      expect(typeof webhookValid).toBe("boolean");
      expect(typeof dispatch.latencyMs).toBe("number");
      expect(typeof action.latencyMs).toBe("number");
      expect(typeof status.latencyMs).toBe("number");
      expect(typeof menu.latencyMs).toBe("number");
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
