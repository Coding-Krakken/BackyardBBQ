/** @jest-environment node */

import { Prisma } from "@bbq/database";
import {
  extractSettlementPayload,
  getEventCorrelationId,
  getPayloadCorrelationId,
  mapInternalToProviderStatus,
  parseWebhookOrderPayload,
  parseWebhookStatusPayload,
} from "../helpers";

describe("worker helper coverage", () => {
  describe("mapInternalToProviderStatus", () => {
    it("maps known internal statuses", () => {
      expect(mapInternalToProviderStatus("confirmed")).toBe("accepted");
      expect(mapInternalToProviderStatus("preparing")).toBe("preparing");
      expect(mapInternalToProviderStatus("ready")).toBe("ready");
      expect(mapInternalToProviderStatus("completed")).toBe("delivered");
      expect(mapInternalToProviderStatus("cancelled")).toBe("cancelled");
    });

    it("returns null for unsupported status", () => {
      expect(mapInternalToProviderStatus("pending")).toBeNull();
      expect(mapInternalToProviderStatus("unknown")).toBeNull();
    });
  });

  describe("correlation id helpers", () => {
    it("uses payload correlation id when present", () => {
      const payload = { correlationId: "corr-123" } as Prisma.JsonObject;
      expect(getPayloadCorrelationId(payload, "fallback")).toBe("corr-123");
    });

    it("falls back when payload correlation id is missing", () => {
      const payload = {} as Prisma.JsonObject;
      expect(getPayloadCorrelationId(payload, "fallback")).toBe("fallback");
    });

    it("prefers event-level correlation id over payload", () => {
      const event = {
        correlationId: "event-corr",
        payload: { correlationId: "payload-corr" } as Prisma.JsonObject,
      };

      expect(getEventCorrelationId(event, "fallback")).toBe("event-corr");
    });

    it("falls back for non-object payload", () => {
      expect(getEventCorrelationId({ payload: null }, "fallback")).toBe("fallback");
      expect(getEventCorrelationId({ payload: [] as unknown as Prisma.JsonValue }, "fallback")).toBe("fallback");
    });

    it("uses payload-level correlation id when event-level is absent", () => {
      const event = {
        payload: { correlationId: "payload-corr" } as Prisma.JsonObject,
      };

      expect(getEventCorrelationId(event, "fallback")).toBe("payload-corr");
    });
  });

  describe("parseWebhookOrderPayload", () => {
    it("returns null when order object is missing", () => {
      expect(parseWebhookOrderPayload({} as Prisma.JsonObject)).toBeNull();
      expect(parseWebhookOrderPayload({ order: "invalid" } as Prisma.JsonObject)).toBeNull();
    });

    it("parses valid webhook order payload", () => {
      const payload = {
        order: {
          externalOrderId: "ext-1",
          source: "doordash",
          subtotalCents: 1500,
          taxCents: 120,
          tipCents: 200,
          totalCents: 1820,
          items: [
            { name: "Brisket", quantity: 1, unitPriceCents: 1500, notes: "No onions" },
          ],
        },
      } as Prisma.JsonObject;

      expect(parseWebhookOrderPayload(payload)).toEqual({
        externalOrderId: "ext-1",
        source: "doordash",
        subtotalCents: 1500,
        taxCents: 120,
        tipCents: 200,
        totalCents: 1820,
        items: [{ name: "Brisket", quantity: 1, unitPriceCents: 1500, notes: "No onions" }],
      });
    });

    it("returns null for invalid source and malformed items", () => {
      const invalidSource = {
        order: {
          externalOrderId: "ext-2",
          source: "unknown",
          subtotalCents: 1000,
          totalCents: 1000,
          items: [{ name: "x", quantity: 1, unitPriceCents: 1000 }],
        },
      } as Prisma.JsonObject;
      expect(parseWebhookOrderPayload(invalidSource)).toBeNull();

      const malformedItems = {
        order: {
          externalOrderId: "ext-3",
          source: "ubereats",
          subtotalCents: 1000,
          totalCents: 1000,
          items: [{ foo: "bar" }],
        },
      } as Prisma.JsonObject;
      expect(parseWebhookOrderPayload(malformedItems)).toBeNull();

      const emptyItems = {
        order: {
          externalOrderId: "ext-4",
          source: "grubhub",
          subtotalCents: 1000,
          totalCents: 1000,
          items: [],
        },
      } as Prisma.JsonObject;
      expect(parseWebhookOrderPayload(emptyItems)).toBeNull();

      const invalidFieldTypes = {
        order: {
          externalOrderId: 123,
          source: 999,
          subtotalCents: "1000",
          totalCents: "1000",
          items: [{ name: "x", quantity: 1, unitPriceCents: 1000 }],
        },
      } as unknown as Prisma.JsonObject;
      expect(parseWebhookOrderPayload(invalidFieldTypes)).toBeNull();
    });

    it("skips non-object item rows and still parses valid rows", () => {
      const payload = {
        order: {
          externalOrderId: "ext-5",
          source: "doordash",
          subtotalCents: 1500,
          totalCents: 1500,
          items: [null, "invalid", { name: "Pulled Pork", quantity: 1, unitPriceCents: 1500 }],
        },
      } as Prisma.JsonObject;

      expect(parseWebhookOrderPayload(payload)).toEqual({
        externalOrderId: "ext-5",
        source: "doordash",
        subtotalCents: 1500,
        taxCents: 0,
        tipCents: 0,
        totalCents: 1500,
        items: [{ name: "Pulled Pork", quantity: 1, unitPriceCents: 1500, notes: undefined }],
      });
    });
  });

  describe("parseWebhookStatusPayload", () => {
    it("parses valid status payload", () => {
      const payload = {
        statusUpdate: {
          internalOrderId: "ord-1",
          status: "ready",
        },
      } as Prisma.JsonObject;

      expect(parseWebhookStatusPayload(payload)).toEqual({
        internalOrderId: "ord-1",
        status: "ready",
      });
    });

    it("returns null for invalid status payload", () => {
      expect(parseWebhookStatusPayload({} as Prisma.JsonObject)).toBeNull();

      const invalid = {
        statusUpdate: { status: "archived" },
      } as Prisma.JsonObject;
      expect(parseWebhookStatusPayload(invalid)).toBeNull();

      const arrayStatus = {
        statusUpdate: [],
      } as unknown as Prisma.JsonObject;
      expect(parseWebhookStatusPayload(arrayStatus)).toBeNull();
    });

    it("handles non-string internalOrderId and non-string status", () => {
      const nonStringInternalOrder = {
        statusUpdate: {
          internalOrderId: 123,
          status: "pending",
        },
      } as unknown as Prisma.JsonObject;

      expect(parseWebhookStatusPayload(nonStringInternalOrder)).toEqual({
        internalOrderId: undefined,
        status: "pending",
      });

      const nonStringStatus = {
        statusUpdate: {
          status: 42,
        },
      } as unknown as Prisma.JsonObject;

      expect(parseWebhookStatusPayload(nonStringStatus)).toBeNull();
    });
  });

  describe("extractSettlementPayload", () => {
    it("returns null when settlement candidate object is absent", () => {
      const payload = {
        settlement: "invalid",
        payload: [],
      } as unknown as Prisma.JsonObject;

      expect(extractSettlementPayload(payload)).toBeNull();
    });

    it("extracts settlement from direct payload", () => {
      const payload = {
        settlement: {
          settlementId: "stl-1",
          payoutId: "po-1",
          externalOrderId: "ext-1",
          grossCents: 1000,
          feesCents: 100,
          netCents: 900,
          currency: "usd",
          settledAt: "2026-01-01T00:00:00Z",
        },
      } as Prisma.JsonObject;

      expect(extractSettlementPayload(payload)).toEqual({
        settlementId: "stl-1",
        payoutId: "po-1",
        externalOrderId: "ext-1",
        grossCents: 1000,
        feesCents: 100,
        netCents: 900,
        currency: "usd",
        settledAt: "2026-01-01T00:00:00Z",
      });
    });

    it("extracts settlement from nested payload and applies defaults", () => {
      const payload = {
        orderExternalId: "ext-2",
        payload: {
          settlementId: "stl-2",
          grossCents: 2000,
          netCents: 1800,
        },
      } as Prisma.JsonObject;

      expect(extractSettlementPayload(payload)).toEqual(
        expect.objectContaining({
          settlementId: "stl-2",
          externalOrderId: "ext-2",
          grossCents: 2000,
          feesCents: 0,
          netCents: 1800,
          currency: "usd",
        })
      );
    });

    it("extracts nested settlement object and uses payload fallbacks", () => {
      const payload = {
        orderExternalId: "ext-3",
        receivedAt: "2026-02-02T00:00:00Z",
        payload: {
          settlement: {
            settlementId: "stl-3",
            grossCents: 3000,
            netCents: 2700,
          },
        },
      } as Prisma.JsonObject;

      expect(extractSettlementPayload(payload)).toEqual(
        expect.objectContaining({
          settlementId: "stl-3",
          externalOrderId: "ext-3",
          grossCents: 3000,
          feesCents: 0,
          netCents: 2700,
          settledAt: "2026-02-02T00:00:00Z",
        })
      );
    });

    it("returns null when required settlement fields are missing", () => {
      const invalid = {
        settlement: {
          grossCents: 100,
          netCents: 90,
        },
      } as Prisma.JsonObject;

      expect(extractSettlementPayload(invalid)).toBeNull();

      const missingGrossOrNet = {
        settlement: {
          settlementId: "stl-4",
          grossCents: 100,
        },
      } as Prisma.JsonObject;

      expect(extractSettlementPayload(missingGrossOrNet)).toBeNull();

      const nonNumberGross = {
        settlement: {
          settlementId: "stl-5",
          grossCents: "100",
          netCents: 90,
        },
      } as unknown as Prisma.JsonObject;

      expect(extractSettlementPayload(nonNumberGross)).toBeNull();
    });
  });
});
