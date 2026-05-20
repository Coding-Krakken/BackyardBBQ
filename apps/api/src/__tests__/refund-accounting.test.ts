import { buildRefundEventFilter, parseRefundAmountCents, REFUND_EVENT_TYPES } from "../accounting/refunds";

describe("refund accounting helpers", () => {
  it("includes admin and api channels with the refund allowlist", () => {
    const start = new Date("2026-05-20T00:00:00.000Z");
    const end = new Date("2026-05-21T00:00:00.000Z");

    expect(buildRefundEventFilter(start, end)).toEqual({
      channel: { in: ["admin", "api"] },
      eventType: { in: [...REFUND_EVENT_TYPES] },
      createdAt: { gte: start, lt: end }
    });
  });

  it("parses refund amounts from supported payload aliases", () => {
    expect(parseRefundAmountCents({ requestedAmountCents: 1250 })).toBe(1250);
    expect(parseRefundAmountCents({ amountCents: "900" })).toBe(900);
    expect(parseRefundAmountCents({ refundAmountCents: 725 })).toBe(725);
    expect(parseRefundAmountCents({ refundAmountCents: "not-a-number" })).toBe(0);
  });
});