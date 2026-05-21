export const REFUND_EVENT_TYPES = [
  "admin.refund.issued",
  "admin.refund.manual_requested",
  "admin.payment_refund_created",
  "admin.payment_refund_requested"
] as const;

export function buildRefundEventFilter(start: Date, end: Date) {
  return {
    channel: { in: ["admin", "api"] },
    eventType: { in: [...REFUND_EVENT_TYPES] },
    createdAt: { gte: start, lt: end }
  };
}

export function parseRefundAmountCents(payload: Record<string, unknown>): number {
  const amountCandidates = [payload.requestedAmountCents, payload.amountCents, payload.refundAmountCents];

  for (const candidate of amountCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
      return Math.floor(candidate);
    }

    if (typeof candidate === "string") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }
  }

  return 0;
}
