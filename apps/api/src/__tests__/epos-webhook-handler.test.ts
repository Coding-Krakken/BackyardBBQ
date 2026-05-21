/** @jest-environment node */

import { createHmac } from "node:crypto";
import { handleEposWebhook } from "../webhook/epos-handler";

type AlertInput = {
  type: string;
  severity: "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
};

function signatureFor(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function buildValidPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    eventType: 304,
    eventId: "evt_304",
    referenceCode: "order_123",
    statusId: 1,
    totalAmount: 41.5,
    ...overrides,
  });
}

type HandleInput = Parameters<typeof handleEposWebhook>[0];
type HandleOverrides = Omit<Partial<HandleInput>, "request" | "logger" | "prisma"> & {
  request?: Partial<HandleInput["request"]>;
  logger?: Partial<HandleInput["logger"]>;
  prisma?: Partial<HandleInput["prisma"]>;
};

function createHarness(overrides: HandleOverrides = {}) {
  const alerts: AlertInput[] = [];
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const upsert = jest.fn().mockResolvedValue({});
  const create = jest.fn().mockResolvedValue({});
  const warn = jest.fn();
  const info = jest.fn();

  const baseInput: HandleInput = {
    request: {
      ip: "203.0.113.10",
      headers: {},
      correlationId: "corr_1",
      rawBody: buildValidPayload(),
    },
    logger: { warn, info },
    allowedIps: [],
    signatureHeader: "x-epos-signature",
    webhookSecret: "epos-secret",
    requireSignature: true,
    hasDatabaseUrl: false,
    prisma: {
      order: { updateMany },
      paymentTransaction: { upsert },
      integrationEvent: { create },
    },
    isWebhookRateLimited: jest.fn().mockResolvedValue(false),
    isWebhookIpAllowed: jest.fn().mockReturnValue(true),
    getRequestIps: jest.fn().mockReturnValue(["203.0.113.10"]),
    verifyHmacSha256Signature: jest.fn().mockReturnValue(true),
    isDuplicateWebhookEvent: jest.fn().mockResolvedValue(false),
    sendOperationalAlert: jest.fn().mockImplementation(async (input: AlertInput) => {
      alerts.push(input);
    }),
  };

  const input = {
    ...baseInput,
    ...overrides,
    request: {
      ...baseInput.request,
      ...(overrides.request ?? {}),
    },
    logger: {
      ...baseInput.logger,
      ...(overrides.logger ?? {}),
    },
    prisma: {
      ...baseInput.prisma,
      ...(overrides.prisma ?? {}),
    },
  };

  return {
    input,
    alerts,
    spies: { updateMany, upsert, create, warn, info },
  };
}

describe("handleEposWebhook", () => {
  it("rejects requests when IP is not allowlisted", async () => {
    const harness = createHarness({
      allowedIps: ["198.51.100.10"],
      isWebhookIpAllowed: jest.fn().mockReturnValue(false),
      getRequestIps: jest.fn().mockReturnValue(["203.0.113.10", "198.51.100.20"]),
    });

    const result = await handleEposWebhook(harness.input);

    expect(result).toEqual({ statusCode: 403, body: { message: "Webhook IP not allowed" } });
    expect(harness.alerts[0]).toEqual(
      expect.objectContaining({
        type: "epos_webhook_ip_not_allowed",
        severity: "critical",
      })
    );
  });

  it("rejects requests when required signature is missing", async () => {
    const harness = createHarness({
      request: {
        headers: {},
      },
    });

    const result = await handleEposWebhook(harness.input);

    expect(result).toEqual({ statusCode: 400, body: { message: "Webhook is not configured" } });
    expect(harness.alerts[0]).toEqual(
      expect.objectContaining({
        type: "epos_webhook_misconfigured",
      })
    );
  });

  it("rejects invalid signatures", async () => {
    const payload = buildValidPayload();
    const harness = createHarness({
      request: {
        rawBody: payload,
        headers: {
          "x-epos-signature": "sha256=invalid",
        },
      },
      verifyHmacSha256Signature: jest.fn().mockReturnValue(false),
    });

    const result = await handleEposWebhook(harness.input);

    expect(result).toEqual({ statusCode: 401, body: { message: "Invalid signature" } });
    expect(harness.alerts[0]).toEqual(
      expect.objectContaining({
        type: "epos_webhook_signature_invalid",
      })
    );
  });

  it("returns duplicate response when event is replayed", async () => {
    const payload = buildValidPayload();
    const secret = "epos-secret";
    const signature = signatureFor(payload, secret);

    const harness = createHarness({
      request: {
        rawBody: payload,
        headers: {
          "x-epos-signature": `sha256=${signature}`,
        },
      },
      isDuplicateWebhookEvent: jest.fn().mockResolvedValue(true),
    });

    const result = await handleEposWebhook(harness.input);

    expect(result).toEqual(
      expect.objectContaining({
        statusCode: 200,
        body: expect.objectContaining({
          received: true,
          duplicate: true,
        }),
      })
    );
    expect(harness.spies.create).not.toHaveBeenCalled();
  });

  it("returns duplicate response when persisted dedupe detects replay", async () => {
    const payload = buildValidPayload({ eventId: "evt_persisted_dupe" });
    const signature = signatureFor(payload, "epos-secret");

    const harness = createHarness({
      hasDatabaseUrl: true,
      request: {
        rawBody: payload,
        headers: {
          "x-epos-signature": `sha256=${signature}`,
        },
      },
      isPersistedDuplicateWebhookEvent: jest.fn().mockResolvedValue(true),
    });

    const result = await handleEposWebhook(harness.input);

    expect(result).toEqual(
      expect.objectContaining({
        statusCode: 200,
        body: expect.objectContaining({
          received: true,
          duplicate: true,
        }),
      })
    );
    expect(harness.spies.create).not.toHaveBeenCalled();
  });

  it("continues processing when persisted dedupe lookup fails", async () => {
    const payload = buildValidPayload({ eventId: "evt_persisted_error", referenceCode: "order_safe" });
    const signature = signatureFor(payload, "epos-secret");

    const harness = createHarness({
      hasDatabaseUrl: true,
      request: {
        rawBody: payload,
        headers: {
          "x-epos-signature": `sha256=${signature}`,
        },
      },
      isPersistedDuplicateWebhookEvent: jest.fn().mockRejectedValue(new Error("db unavailable")),
    });

    const result = await handleEposWebhook(harness.input);

    expect(result.statusCode).toBe(200);
    expect(harness.spies.create).toHaveBeenCalledTimes(1);
    expect(harness.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "epos_webhook_duplicate_check_failed",
          severity: "warning",
        }),
      ])
    );
  });

  it("persists unknown event names and updates order transaction for completed payments", async () => {
    const payload = buildValidPayload({
      eventType: 999,
      eventId: "evt_unknown",
      referenceCode: "order_abc",
      statusId: 1,
      totalAmount: 10.25,
    });
    const signature = signatureFor(payload, "epos-secret");

    const harness = createHarness({
      hasDatabaseUrl: true,
      request: {
        rawBody: payload,
        headers: {
          "x-epos-signature": `sha256=${signature}`,
        },
      },
    });

    const result = await handleEposWebhook(harness.input);

    expect(result.statusCode).toBe(200);
    expect(harness.spies.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.spies.upsert).toHaveBeenCalledTimes(1);
    expect(harness.spies.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "epos.webhook.Unknown-999",
          payload: expect.objectContaining({
            paymentStatus: "succeeded",
            referenceCode: "order_abc",
          }),
        }),
      })
    );
  });

  it("creates deposit transaction updates for booking reference codes", async () => {
    const payload = buildValidPayload({
      eventType: 304,
      eventId: "evt_booking",
      referenceCode: "booking:bk_123",
      statusId: 1,
      totalAmount: 12.0,
    });
    const signature = signatureFor(payload, "epos-secret");

    const harness = createHarness({
      hasDatabaseUrl: true,
      request: {
        rawBody: payload,
        headers: {
          "x-epos-signature": `sha256=${signature}`,
        },
      },
    });

    const result = await handleEposWebhook(harness.input);

    expect(result.statusCode).toBe(200);
    expect(harness.spies.updateMany).not.toHaveBeenCalled();
    expect(harness.spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          bookingId: "bk_123",
          paymentType: "deposit",
          status: "succeeded",
        }),
      })
    );
    expect(harness.spies.create).toHaveBeenCalled();
  });
});
