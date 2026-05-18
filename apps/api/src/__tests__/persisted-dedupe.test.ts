/** @jest-environment node */

import { isPersistedDuplicateWebhookEvent } from "../webhook/persisted-dedupe";

type StripeEventLike = {
  id: string;
  type: string;
};

describe("isPersistedDuplicateWebhookEvent", () => {
  it("returns false when database is disabled", async () => {
    const findMany = jest.fn(async () => []);
    const event: StripeEventLike = { id: "evt_1", type: "payment_intent.succeeded" };

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
    const event: StripeEventLike = { id: "evt_2", type: "checkout.session.completed" };

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
    const event: StripeEventLike = { id: "evt_match", type: "charge.dispute.created" };

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
    const event: StripeEventLike = { id: "evt_target", type: "payment_intent.failed" };

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
