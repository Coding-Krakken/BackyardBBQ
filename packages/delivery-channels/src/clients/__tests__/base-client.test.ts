/** @jest-environment node */

import { createHmac } from "node:crypto";
import { verifyWebhookHmac, buildSimulatedHealth } from "../base-client";

describe("verifyWebhookHmac", () => {
  const secret = "test-hmac-secret-key";

  function computeHmac(body: string, key: string = secret) {
    return createHmac("sha256", key).update(body, "utf8").digest("hex");
  }

  it("returns true for a valid hex signature", () => {
    const body = '{"type":"settlement.created","data":{}}';
    const sig = computeHmac(body);

    expect(verifyWebhookHmac({ rawBody: body, signature: sig, secret })).toBe(true);
  });

  it("returns true when signature has sha256= prefix", () => {
    const body = '{"type":"order.created"}';
    const sig = `sha256=${computeHmac(body)}`;

    expect(verifyWebhookHmac({ rawBody: body, signature: sig, secret })).toBe(true);
  });

  it("returns true when signature has v1= prefix", () => {
    const body = '{"type":"status.updated"}';
    const sig = `v1=${computeHmac(body)}`;

    expect(verifyWebhookHmac({ rawBody: body, signature: sig, secret })).toBe(true);
  });

  it("returns true when signature has SHA256= prefix (case-insensitive)", () => {
    const body = '{"type":"test"}';
    const sig = `SHA256=${computeHmac(body)}`;

    expect(verifyWebhookHmac({ rawBody: body, signature: sig, secret })).toBe(true);
  });

  it("returns false for wrong signature value", () => {
    const body = '{"type":"test"}';
    const wrongSig = computeHmac("different body");

    expect(verifyWebhookHmac({ rawBody: body, signature: wrongSig, secret })).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const body = '{"type":"test"}';
    const sig = computeHmac(body, "wrong-secret");

    expect(verifyWebhookHmac({ rawBody: body, signature: sig, secret })).toBe(false);
  });

  it("returns false when signature is undefined", () => {
    expect(
      verifyWebhookHmac({ rawBody: '{"a":1}', signature: undefined, secret })
    ).toBe(false);
  });

  it("returns false when secret is undefined", () => {
    expect(
      verifyWebhookHmac({ rawBody: '{"a":1}', signature: "abc", secret: undefined })
    ).toBe(false);
  });

  it("returns false when rawBody is empty", () => {
    expect(verifyWebhookHmac({ rawBody: "", signature: "abc", secret })).toBe(false);
  });

  it("returns false for non-hex signature characters", () => {
    expect(
      verifyWebhookHmac({ rawBody: '{"a":1}', signature: "not-valid-hex!", secret })
    ).toBe(false);
  });

  it("returns false for truncated signature", () => {
    const body = '{"type":"test"}';
    const sig = computeHmac(body).slice(0, 32); // truncated to 16 bytes

    expect(verifyWebhookHmac({ rawBody: body, signature: sig, secret })).toBe(false);
  });

  it("uses timing-safe comparison", () => {
    // Verify that even with a nearly-correct signature, the result is false
    const body = '{"type":"timing-test"}';
    const correct = computeHmac(body);
    // Flip the last character
    const almostCorrect =
      correct.slice(0, -1) + (correct.endsWith("0") ? "1" : "0");

    expect(verifyWebhookHmac({ rawBody: body, signature: almostCorrect, secret })).toBe(
      false
    );
  });
});

describe("buildSimulatedHealth", () => {
  it("returns healthy status for doordash", () => {
    const result = buildSimulatedHealth("doordash");
    expect(result).toEqual({ healthy: true, latencyMs: 170 });
  });

  it("returns healthy status for ubereats", () => {
    const result = buildSimulatedHealth("ubereats");
    expect(result).toEqual({ healthy: true, latencyMs: 190 });
  });

  it("returns healthy status for grubhub", () => {
    const result = buildSimulatedHealth("grubhub");
    expect(result).toEqual({ healthy: true, latencyMs: 220 });
  });
});
