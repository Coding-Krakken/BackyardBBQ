type StripeEventLike = {
  id: string;
  type: string;
};

type PersistedWebhookEventRow = {
  payload: unknown;
};

type IntegrationEventReader = {
  findMany: (args: {
    where: {
      channel: "stripe";
      eventType: string;
      createdAt: { gte: Date };
    };
    orderBy: { createdAt: "desc" };
    take: number;
    select: { payload: true };
  }) => Promise<PersistedWebhookEventRow[]>;
};

export async function isPersistedDuplicateWebhookEvent(input: {
  hasDatabaseUrl: boolean;
  integrationEvent: IntegrationEventReader;
  event: StripeEventLike;
  webhookEventTtlMs: number;
  now?: number;
}) {
  if (!input.hasDatabaseUrl) {
    return false;
  }

  const now = input.now ?? Date.now();
  const since = new Date(now - input.webhookEventTtlMs);
  const recentEvents = await input.integrationEvent.findMany({
    where: {
      channel: "stripe",
      eventType: input.event.type,
      createdAt: { gte: since }
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      payload: true
    }
  });

  return recentEvents.some((row) => {
    if (typeof row.payload !== "object" || row.payload === null) {
      return false;
    }

    const payload = row.payload as Record<string, unknown>;
    return payload.eventId === input.event.id;
  });
}
