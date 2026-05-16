/** @jest-environment node */

import type Stripe from "stripe";
import { isPersistedDuplicateWebhookEvent } from "../webhook/persisted-dedupe";

describe("isPersistedDuplicateWebhookEvent", () => {
  it("returns false when database is disabled", async () => {
    const findMany = jest.fn(async () => []);
    const event = { id: "evt_1", type: "payment_intent.succeeded" } as unknown as Stripe.Event;

    const result = await isPersistedDuplicateWebhookEvent({
      hasDatabaseUrl: false,
      integrationEvent: { findMany },
      event,
      webhookEventTtlMs: 60000,
      now: 1000
    });

    expect(result).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries recent stripe events using event type and ttl window", async () => {
    const findMany = jest.fn(async () => []);
    const event = { id: "evt_2", type: "checkout.session.completed" } as unknown as Stripe.Event;

    await isPersistedDuplicateWebhookEvent({
      hasDatabaseUrl: true,
      integrationEvent: { findMany },
      event,
      webhookEventTtlMs: 30000,
      now: 50000
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        channel: "stripe",
        eventType: "checkout.session.completed",
        createdAt: { gte: new Date(20000) }
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { payload: true }
    });
  });

  it("returns true when matching eventId exists in persisted payload", async () => {
    const findMany = jest.fn(async () => [
      { payload: { eventId: "evt_a" } },
      { payload: { eventId: "evt_match" } }
    ]);
    const event = { id: "evt_match", type: "charge.dispute.created" } as unknown as Stripe.Event;

    const result = await isPersistedDuplicateWebhookEvent({
      hasDatabaseUrl: true,
      integrationEvent: { findMany },
      event,
      webhookEventTtlMs: 86400000,
      now: 100000
    });

    expect(result).toBe(true);
  });

  it("ignores malformed payloads and returns false when no eventId matches", async () => {
    const findMany = jest.fn(async () => [
      { payload: null },
      { payload: "not-object" },
      { payload: { eventId: "evt_other" } }
    ]);
    const event = { id: "evt_target", type: "payment_intent.failed" } as unknown as Stripe.Event;

    const result = await isPersistedDuplicateWebhookEvent({
      hasDatabaseUrl: true,
      integrationEvent: { findMany },
      event,
      webhookEventTtlMs: 86400000,
      now: 100000
    });

    expect(result).toBe(false);
  });
});
