/** @jest-environment node */

import type Stripe from "stripe";
import { getCheckoutSessionIdentifiers, shouldTreatWebhookEventAsDuplicate } from "../webhook/utils";

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
});

describe("getCheckoutSessionIdentifiers", () => {
  it("extracts customer, payment intent, and order id metadata", () => {
    const session = {
      customer: "cus_123",
      payment_intent: "pi_123",
      metadata: { orderId: "ord_123" },
    } as unknown as Stripe.Checkout.Session;

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
    } as unknown as Stripe.Checkout.Session;

    expect(getCheckoutSessionIdentifiers(session)).toEqual({
      stripeCustomerId: undefined,
      paymentIntentId: undefined,
      orderId: undefined,
    });
  });
});
