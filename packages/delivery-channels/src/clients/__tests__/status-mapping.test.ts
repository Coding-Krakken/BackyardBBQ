/** @jest-environment node */

import { mapProviderActionPayload } from "../status-mapping";

describe("mapProviderActionPayload", () => {
  describe("doordash status mapping", () => {
    const doordashMappings = [
      { status: "accepted", expected: "accepted" },
      { status: "preparing", expected: "preparing" },
      { status: "ready", expected: "ready_for_pickup" },
      { status: "out_for_delivery", expected: "out_for_delivery" },
      { status: "delivered", expected: "delivered" },
      { status: "cancelled", expected: "cancelled" },
    ] as const;

    for (const { status, expected } of doordashMappings) {
      it(`maps "${status}" to "${expected}"`, () => {
        const result = mapProviderActionPayload({ channel: "doordash", status });
        expect(result.providerStatus).toBe(expected);
      });
    }
  });

  describe("ubereats status mapping", () => {
    const ubereatsExpected: Record<string, string> = {
      accepted: "accepted",
      preparing: "in_progress",
      ready: "ready",
      out_for_delivery: "courier_en_route",
      delivered: "completed",
      cancelled: "cancelled",
    };

    for (const [status, expected] of Object.entries(ubereatsExpected)) {
      it(`maps "${status}" to "${expected}"`, () => {
        const result = mapProviderActionPayload({
          channel: "ubereats",
          status: status as any,
        });
        expect(result.providerStatus).toBe(expected);
      });
    }
  });

  describe("grubhub status mapping", () => {
    const grubhubExpected: Record<string, string> = {
      accepted: "confirmed",
      preparing: "preparing",
      ready: "ready",
      out_for_delivery: "in_transit",
      delivered: "fulfilled",
      cancelled: "cancelled",
    };

    for (const [status, expected] of Object.entries(grubhubExpected)) {
      it(`maps "${status}" to "${expected}"`, () => {
        const result = mapProviderActionPayload({
          channel: "grubhub",
          status: status as any,
        });
        expect(result.providerStatus).toBe(expected);
      });
    }
  });

  describe("reason codes", () => {
    it("uses default reason code when no custom reason given", () => {
      const result = mapProviderActionPayload({
        channel: "doordash",
        status: "accepted",
      });
      expect(result.providerReasonCode).toBe("ACCEPTED_BY_MERCHANT");
    });

    it("uses custom reason when provided", () => {
      const result = mapProviderActionPayload({
        channel: "doordash",
        status: "cancelled",
        reason: "Customer requested cancellation",
      });
      expect(result.providerReasonCode).toBe("Customer requested cancellation");
    });

    it("truncates custom reason to 120 characters", () => {
      const longReason = "A".repeat(200);
      const result = mapProviderActionPayload({
        channel: "doordash",
        status: "cancelled",
        reason: longReason,
      });
      expect(result.providerReasonCode).toHaveLength(120);
    });

    it("returns default reason codes for each status", () => {
      const defaults: Record<string, string> = {
        accepted: "ACCEPTED_BY_MERCHANT",
        preparing: "IN_PREPARATION",
        ready: "READY_FOR_HANDOFF",
        out_for_delivery: "OUT_FOR_DELIVERY",
        delivered: "DELIVERED",
        cancelled: "CANCELLED_BY_MERCHANT",
      };

      for (const [status, expectedCode] of Object.entries(defaults)) {
        const result = mapProviderActionPayload({
          channel: "doordash",
          status: status as any,
        });
        expect(result.providerReasonCode).toBe(expectedCode);
      }
    });
  });
});
