type CheckoutSessionLike = {
  customer?: string | object | null;
  payment_intent?: string | object | null;
  metadata?: Record<string, string> | null;
};

export function shouldTreatWebhookEventAsDuplicate(
  processedWebhookEvents: Map<string, number>,
  eventId: string,
  webhookEventTtlMs: number,
  now = Date.now()
) {
  for (const [storedEventId, storedAt] of processedWebhookEvents) {
    if (now - storedAt > webhookEventTtlMs) {
      processedWebhookEvents.delete(storedEventId);
    }
  }

  const existing = processedWebhookEvents.get(eventId);
  if (typeof existing === "number" && now - existing <= webhookEventTtlMs) {
    return true;
  }

  processedWebhookEvents.set(eventId, now);
  return false;
}

export function getCheckoutSessionIdentifiers(session: CheckoutSessionLike) {
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : undefined;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
  const orderId =
    typeof session.metadata?.orderId === "string" && session.metadata.orderId
      ? session.metadata.orderId
      : undefined;

  return {
    stripeCustomerId,
    paymentIntentId,
    orderId,
  };
}
