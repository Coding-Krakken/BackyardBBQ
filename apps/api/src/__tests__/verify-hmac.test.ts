/** @jest-environment node */

import { createHmac } from "node:crypto";
import { verifyHmacSha256Signature } from "../utils/verifyHmac";

describe("verifyHmacSha256Signature", () => {
  const rawBody = '{"event":"checkout.session.completed"}';
  const secret = "hmac-secret";

  function signatureFor(body: string, key = secret) {
    return createHmac("sha256", key).update(body, "utf8").digest("hex");
  }

  it("returns true for valid signatures", () => {
    const signature = signatureFor(rawBody);

    expect(
      verifyHmacSha256Signature({
        rawBody,
        signature,
        secret
      })
    ).toBe(true);
  });

  it("returns false for tampered payloads", () => {
    const signature = signatureFor(rawBody);

    expect(
      verifyHmacSha256Signature({
        rawBody: '{"event":"payment_intent.failed"}',
        signature,
        secret
      })
    ).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const signature = signatureFor(rawBody, "different-secret");

    expect(
      verifyHmacSha256Signature({
        rawBody,
        signature,
        secret
      })
    ).toBe(false);
  });

  it("returns false for same-length but incorrect signature", () => {
    const signature = signatureFor(rawBody);
    const mutated = signature.slice(0, -1) + (signature.endsWith("0") ? "1" : "0");

    expect(
      verifyHmacSha256Signature({
        rawBody,
        signature: mutated,
        secret
      })
    ).toBe(false);
  });
});
