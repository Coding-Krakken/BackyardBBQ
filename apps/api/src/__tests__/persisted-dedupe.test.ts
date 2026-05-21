/** @jest-environment node */

import { isPersistedDuplicateIntegrationEvent } from "../webhook/persisted-dedupe";

describe("isPersistedDuplicateIntegrationEvent", () => {
  it("returns false when database is disabled", async () => {
    const findMany = jest.fn(async () => []);

    const result = await isPersistedDuplicateIntegrationEvent({
      hasDatabaseUrl: false,
      integrationEvent: { findMany },
      channel: "epos",
      eventType: "epos.webhook.CompleteTransaction",
      eventId: "epos_evt_1",
      webhookEventTtlMs: 60000,
      now: 1000
    });

    expect(result).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries epos channel events using event type and ttl window", async () => {
    const findMany = jest.fn(async () => []);

    await isPersistedDuplicateIntegrationEvent({
      hasDatabaseUrl: true,
      integrationEvent: { findMany },
      channel: "epos",
      eventType: "epos.webhook.CompleteTransaction",
      eventId: "epos_evt_2",
      webhookEventTtlMs: 30000,
      now: 50000
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        channel: "epos",
        eventType: "epos.webhook.CompleteTransaction",
        createdAt: { gte: new Date(20000) }
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { payload: true }
    });
  });

  it("uses Date.now fallback when now is not provided", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(90_000);
    const findMany = jest.fn(async () => []);

    await isPersistedDuplicateIntegrationEvent({
      hasDatabaseUrl: true,
      integrationEvent: { findMany },
      channel: "epos",
      eventType: "epos.webhook.CompleteTransaction",
      eventId: "epos_now_fallback",
      webhookEventTtlMs: 30_000
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date(60_000) }
        })
      })
    );

    nowSpy.mockRestore();
  });

  it("returns true when matching eventId exists in persisted payload", async () => {
    const findMany = jest.fn(async () => [
      { payload: { eventId: "epos_evt_a" } },
      { payload: { eventId: "epos_evt_match" } }
    ]);

    const result = await isPersistedDuplicateIntegrationEvent({
      hasDatabaseUrl: true,
      integrationEvent: { findMany },
      channel: "epos",
      eventType: "epos.webhook.RefundTransaction",
      eventId: "epos_evt_match",
      webhookEventTtlMs: 86400000,
      now: 100000
    });

    expect(result).toBe(true);
  });

  it("ignores malformed payloads and returns false when no eventId matches", async () => {
    const findMany = jest.fn(async () => [
      { payload: null },
      { payload: "not-object" },
      { payload: { eventId: "epos_evt_other" } }
    ]);

    const result = await isPersistedDuplicateIntegrationEvent({
      hasDatabaseUrl: true,
      integrationEvent: { findMany },
      channel: "epos",
      eventType: "epos.webhook.VoidTransaction",
      eventId: "epos_evt_target",
      webhookEventTtlMs: 86400000,
      now: 100000
    });

    expect(result).toBe(false);
  });

  it("queries EPOS channel event window and detects duplicate event id", async () => {
    const findMany = jest.fn(async () => [{ payload: { eventId: "epos_evt_1" } }]);

    const result = await isPersistedDuplicateIntegrationEvent({
      hasDatabaseUrl: true,
      integrationEvent: { findMany },
      channel: "epos",
      eventType: "epos.webhook.CompleteTransaction",
      eventId: "epos_evt_1",
      webhookEventTtlMs: 30_000,
      now: 50_000
    });

    expect(result).toBe(true);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        channel: "epos",
        eventType: "epos.webhook.CompleteTransaction",
        createdAt: { gte: new Date(20_000) }
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { payload: true }
    });
  });

  it("returns false for malformed payloads without matching event id", async () => {
    const findMany = jest.fn(async () => [
      { payload: null },
      { payload: "invalid" },
      { payload: { eventId: "epos_evt_other" } }
    ]);

    const result = await isPersistedDuplicateIntegrationEvent({
      hasDatabaseUrl: true,
      integrationEvent: { findMany },
      channel: "epos",
      eventType: "epos.webhook.Unknown-999",
      eventId: "epos_evt_target",
      webhookEventTtlMs: 60_000,
      now: 100_000
    });

    expect(result).toBe(false);
  });
});
