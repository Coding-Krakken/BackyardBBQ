import { createHmac, timingSafeEqual } from "node:crypto";

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

export function verifyWebhookHmac(input: {
  rawBody: string;
  signature?: string;
  secret?: string;
}) {
  if (!input.signature || !input.secret || input.rawBody.length === 0) {
    return false;
  }

  const normalizedSignature = input.signature.replace(/^(sha256=|v1=)/i, "").trim();
  const expected = createHmac("sha256", input.secret).update(input.rawBody, "utf8").digest("hex");

  const provided = Buffer.from(normalizedSignature, "hex");
  const computed = Buffer.from(expected, "hex");

  if (provided.length === 0 || computed.length === 0 || provided.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(provided, computed);
}

export async function performProviderRequest(input: {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  apiKey: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}) {
  const timeoutMs = input.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input.url, {
      method: input.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Provider request failed (${response.status}): ${responseText}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json().catch(() => null);
  } finally {
    clearTimeout(timer);
  }
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
