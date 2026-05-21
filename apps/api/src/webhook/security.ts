import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export function sanitizeCorrelationId(input: unknown) {
  if (typeof input !== "string") {
    return null;
  }

  const value = input.trim();
  if (!value) {
    return null;
  }

  return value.slice(0, 120);
}

export function resolveRequestCorrelationId(
  headers: Record<string, unknown>,
  fallbackFactory: () => string = randomUUID
) {
  return (
    sanitizeCorrelationId(headers["x-correlation-id"]) ??
    sanitizeCorrelationId(headers["x-request-id"]) ??
    fallbackFactory()
  );
}

export function getRequestIps(request: { ip: string; headers: Record<string, unknown> }) {
  const forwarded = request.headers["x-forwarded-for"];
  const fromForwarded =
    typeof forwarded === "string"
      ? forwarded
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  return [request.ip, ...fromForwarded].filter(Boolean);
}

export function isWebhookIpAllowed(
  request: { ip: string; headers: Record<string, unknown> },
  allowedIps: string[]
) {
  if (allowedIps.length === 0) {
    return true;
  }

  const requestIps = getRequestIps(request);
  return requestIps.some((ip) => allowedIps.includes(ip));
}

export function stripKnownSignaturePrefixes(signature: string) {
  const trimmed = signature.trim();
  return trimmed.replace(/^(sha256=|v1=)/i, "");
}

export function verifyHmacSha256Signature(input: {
  rawBody: string;
  signature: string;
  secret: string;
}) {
  const normalizedSignature = stripKnownSignaturePrefixes(input.signature);
  const computedSignature = createHmac("sha256", input.secret)
    .update(input.rawBody, "utf8")
    .digest("hex");

  const signatureBuffer = Buffer.from(normalizedSignature, "hex");
  const computedBuffer = Buffer.from(computedSignature, "hex");

  if (signatureBuffer.length === 0 || computedBuffer.length === 0) {
    return false;
  }

  if (signatureBuffer.length !== computedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, computedBuffer);
}
