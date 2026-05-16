export type DeliveryChannel = "doordash" | "ubereats" | "grubhub";

export type DeliveryProviderCredentials = {
  apiKey: string;
  apiSecret?: string;
  webhookSecret?: string;
  merchantId?: string;
  storeId?: string;
};

export type InboundWebhookValidationInput = {
  signature?: string;
  rawBody: string;
};

export type ProviderHealthSnapshot = {
  healthy: boolean;
  latencyMs: number;
  reason?: string;
};

export type ProviderStatusSyncInput = {
  externalOrderId: string;
  status: "accepted" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
  reason?: string;
  occurredAt: string;
};

export type ProviderMenuItem = {
  externalItemId?: string;
  name: string;
  priceCents: number;
  available: boolean;
};

export type ProviderMenuSnapshot = {
  locationId: string;
  items: ProviderMenuItem[];
  publishedAt: string;
};

export type ProviderInboundOrder = {
  externalOrderId: string;
  idempotencyKey: string;
  totalCents: number;
  placedAt: string;
  items: Array<{ name: string; quantity: number }>;
};

export interface DeliveryProviderClient {
  readonly channel: DeliveryChannel;
  verifyWebhookSignature(input: InboundWebhookValidationInput): Promise<boolean>;
  parseInboundOrder(payload: Record<string, unknown>): Promise<ProviderInboundOrder>;
  syncOrderStatus(input: ProviderStatusSyncInput): Promise<void>;
  publishMenuSnapshot(snapshot: ProviderMenuSnapshot): Promise<void>;
  checkHealth(): Promise<ProviderHealthSnapshot>;
}

export function buildSimulatedHealth(channel: DeliveryChannel): ProviderHealthSnapshot {
  const baseLatencyByChannel: Record<DeliveryChannel, number> = {
    doordash: 170,
    ubereats: 190,
    grubhub: 220
  };

  return {
    healthy: true,
    latencyMs: baseLatencyByChannel[channel]
  };
}
