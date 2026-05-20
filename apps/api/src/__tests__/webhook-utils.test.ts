/** @jest-environment node */

import { shouldTreatWebhookEventAsDuplicate } from "../webhook/utils";

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
