/** @jest-environment node */

import { createHmac } from "node:crypto";
import {
  getRequestIps,
  isWebhookIpAllowed,
  resolveRequestCorrelationId,
  sanitizeCorrelationId,
  stripKnownSignaturePrefixes,
  verifyHmacSha256Signature,
} from "../webhook/security";

describe("webhook security helpers", () => {
  describe("sanitizeCorrelationId", () => {
    it("returns null for non-string or blank values", () => {
      expect(sanitizeCorrelationId(undefined)).toBeNull();
      expect(sanitizeCorrelationId(123)).toBeNull();
      expect(sanitizeCorrelationId("   ")).toBeNull();
    });

    it("trims and caps correlation id length", () => {
      const long = `  ${"a".repeat(200)}  `;
      const sanitized = sanitizeCorrelationId(long);
      expect(sanitized).toHaveLength(120);
      expect(sanitized).toBe("a".repeat(120));
    });
  });

  describe("resolveRequestCorrelationId", () => {
    it("prefers x-correlation-id", () => {
      const id = resolveRequestCorrelationId({
        "x-correlation-id": "corr-1",
        "x-request-id": "req-1",
      });
      expect(id).toBe("corr-1");
    });

    it("falls back to x-request-id then generated id", () => {
      expect(resolveRequestCorrelationId({ "x-request-id": "req-2" })).toBe("req-2");
      expect(resolveRequestCorrelationId({}, () => "generated-id")).toBe("generated-id");
    });
  });

  describe("request ip handling", () => {
    it("extracts request ip and forwarded ips", () => {
      const ips = getRequestIps({
        ip: "10.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.20" },
      });

      expect(ips).toEqual(["10.0.0.1", "203.0.113.10", "198.51.100.20"]);
    });

    it("enforces ip allowlist when configured", () => {
      const request = {
        ip: "10.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.20" },
      };

      expect(isWebhookIpAllowed(request, [])).toBe(true);
      expect(isWebhookIpAllowed(request, ["198.51.100.20"])).toBe(true);
      expect(isWebhookIpAllowed(request, ["192.0.2.30"])).toBe(false);
    });

    it("ignores forwarded header when it is not a string", () => {
      const ips = getRequestIps({
        ip: "10.0.0.9",
        headers: { "x-forwarded-for": 12345 as unknown as string },
      });

      expect(ips).toEqual(["10.0.0.9"]);
    });
  });

  describe("signature helpers", () => {
    it("strips known signature prefixes", () => {
      expect(stripKnownSignaturePrefixes("sha256=abcdef")).toBe("abcdef");
      expect(stripKnownSignaturePrefixes("v1=abcdef")).toBe("abcdef");
      expect(stripKnownSignaturePrefixes("  SHA256=abcdef  ")).toBe("abcdef");
    });

    it("verifies valid hmac signatures", () => {
      const rawBody = JSON.stringify({ event: "checkout.session.completed" });
      const secret = "webhook-secret";
      const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

      expect(
        verifyHmacSha256Signature({
          rawBody,
          signature: `sha256=${signature}`,
          secret,
        })
      ).toBe(true);
    });

    it("rejects invalid, malformed, and wrong-length signatures", () => {
      const rawBody = JSON.stringify({ event: "checkout.session.completed" });
      const secret = "webhook-secret";

      expect(
        verifyHmacSha256Signature({
          rawBody,
          signature: "not-hex",
          secret,
        })
      ).toBe(false);

      expect(
        verifyHmacSha256Signature({
          rawBody,
          signature: "abc123",
          secret,
        })
      ).toBe(false);

      const valid = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      expect(
        verifyHmacSha256Signature({
          rawBody,
          signature: `${valid}00`,
          secret,
        })
      ).toBe(false);
    });
  });
});
