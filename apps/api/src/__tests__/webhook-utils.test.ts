/** @jest-environment node */

import { getCheckoutSessionIdentifiers, shouldTreatWebhookEventAsDuplicate } from "../webhook/utils";

type CheckoutSessionLike = {
  customer?: string | null;
  payment_intent?: string | null;
  metadata?: Record<string, string>;
};

describe("shouldTreatWebhookEventAsDuplicate", () => {
  it("returns false for first event and true for immediate duplicate", () => {
    const store = new Map<string, number>();
    const now = 1000;

    expect(shouldTreatWebhookEventAsDuplicate(store, "evt_1", 60000, now)).toBe(false);
    expect(shouldTreatWebhookEventAsDuplicate(store, "evt_1", 60000, now + 10)).toBe(true);
  });

  it("expires old entries based on ttl", () => {
    const store = new Map<string, number>();
    const now = 2000;

    expect(shouldTreatWebhookEventAsDuplicate(store, "evt_old", 100, now)).toBe(false);
    expect(shouldTreatWebhookEventAsDuplicate(store, "evt_old", 100, now + 150)).toBe(false);
  });

  it("cleans stale events while preserving fresh entries", () => {
    const store = new Map<string, number>();
    store.set("evt_stale", 1000);
    store.set("evt_fresh", 1900);

    shouldTreatWebhookEventAsDuplicate(store, "evt_new", 200, 2000);

    expect(store.has("evt_stale")).toBe(false);
    expect(store.has("evt_fresh")).toBe(true);
    expect(store.has("evt_new")).toBe(true);
  });

  it("uses Date.now when now is not provided", () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(5000);
    const store = new Map<string, number>();

    expect(shouldTreatWebhookEventAsDuplicate(store, "evt_default_now", 1000)).toBe(false);
    expect(store.get("evt_default_now")).toBe(5000);

    nowSpy.mockRestore();
  });
});

describe("getCheckoutSessionIdentifiers", () => {
  it("extracts customer, payment intent, and order id metadata", () => {
    const session = {
      customer: "cus_123",
      payment_intent: "pi_123",
      metadata: { orderId: "ord_123" },
    } satisfies CheckoutSessionLike;

    expect(getCheckoutSessionIdentifiers(session)).toEqual({
      stripeCustomerId: "cus_123",
      paymentIntentId: "pi_123",
      orderId: "ord_123",
    });
  });

  it("returns undefined values when identifier fields are absent", () => {
    const session = {
      customer: null,
      payment_intent: null,
      metadata: {},
    } satisfies CheckoutSessionLike;

    expect(getCheckoutSessionIdentifiers(session)).toEqual({
      stripeCustomerId: undefined,
      paymentIntentId: undefined,
      orderId: undefined,
    });
  });

  it("treats object and empty metadata identifiers as undefined", () => {
    const session = {
      customer: { id: "cus_obj" },
      payment_intent: { id: "pi_obj" },
      metadata: { orderId: "" },
    } as unknown as CheckoutSessionLike;

    expect(getCheckoutSessionIdentifiers(session)).toEqual({
      stripeCustomerId: undefined,
      paymentIntentId: undefined,
      orderId: undefined,
    });
  });

  it("treats non-string orderId metadata as undefined", () => {
    const session = {
      customer: "cus_123",
      payment_intent: "pi_123",
      metadata: { orderId: 12345 },
    } as unknown as CheckoutSessionLike;

    expect(getCheckoutSessionIdentifiers(session)).toEqual({
      stripeCustomerId: "cus_123",
      paymentIntentId: "pi_123",
      orderId: undefined,
    });
  });

  it("treats null metadata as undefined identifiers", () => {
    const session = {
      customer: "cus_999",
      payment_intent: "pi_999",
      metadata: null,
    } as unknown as CheckoutSessionLike;

    expect(getCheckoutSessionIdentifiers(session)).toEqual({
      stripeCustomerId: "cus_999",
      paymentIntentId: "pi_999",
      orderId: undefined,
    });
  });
});
