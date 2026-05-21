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
