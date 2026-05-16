import {
  buildSimulatedHealth,
  type DeliveryProviderClient,
  type DeliveryProviderCredentials,
  type InboundWebhookValidationInput,
  performProviderRequest,
  type ProviderHealthSnapshot,
  type ProviderInboundOrder,
  type ProviderMenuSnapshot,
  type ProviderStatusSyncInput,
  verifyWebhookHmac
} from "./base-client";

export class DoorDashClient implements DeliveryProviderClient {
  readonly channel = "doordash" as const;

  private readonly baseUrl: string;

  constructor(private readonly credentials: DeliveryProviderCredentials) {
    this.baseUrl = process.env.DOORDASH_API_BASE_URL?.trim() || "https://openapi.doordash.com";
  }

  async verifyWebhookSignature(input: InboundWebhookValidationInput): Promise<boolean> {
    return verifyWebhookHmac({
      rawBody: input.rawBody,
      signature: input.signature,
      secret: this.credentials.webhookSecret
    });
  }

  async parseInboundOrder(payload: Record<string, unknown>): Promise<ProviderInboundOrder> {
    const externalOrderId = String(payload.externalOrderId ?? payload.id ?? "");
    if (!externalOrderId) {
      throw new Error("DoorDash payload missing external order id");
    }

    return {
      externalOrderId,
      idempotencyKey: `doordash:${externalOrderId}`,
      totalCents: Number(payload.totalCents ?? 0),
      placedAt: new Date().toISOString(),
      items: []
    };
  }

  async syncOrderStatus(_input: ProviderStatusSyncInput): Promise<void> {
    if (!this.credentials.apiKey || !this.credentials.storeId) {
      return;
    }

    await performProviderRequest({
      url: `${this.baseUrl}/drive/v2/stores/${encodeURIComponent(this.credentials.storeId)}/orders/${encodeURIComponent(_input.externalOrderId)}/status`,
      method: "POST",
      apiKey: this.credentials.apiKey,
      body: {
        status: _input.status,
        reason: _input.reason,
        occurredAt: _input.occurredAt
      }
    });
  }

  async publishMenuSnapshot(_snapshot: ProviderMenuSnapshot): Promise<void> {
    if (!this.credentials.apiKey || !this.credentials.storeId) {
      return;
    }

    await performProviderRequest({
      url: `${this.baseUrl}/marketplace/v1/stores/${encodeURIComponent(this.credentials.storeId)}/menu`,
      method: "PUT",
      apiKey: this.credentials.apiKey,
      body: {
        locationId: _snapshot.locationId,
        publishedAt: _snapshot.publishedAt,
        items: _snapshot.items
      }
    });
  }

  async checkHealth(): Promise<ProviderHealthSnapshot> {
    if (!this.credentials.apiKey) {
      return {
        healthy: false,
        latencyMs: 0,
        reason: "DoorDash credentials not configured"
      };
    }

    const start = Date.now();
    try {
      await performProviderRequest({
        url: `${this.baseUrl}/drive/v2/health`,
        method: "GET",
        apiKey: this.credentials.apiKey
      });

      return {
        healthy: true,
        latencyMs: Date.now() - start
      };
    } catch {
      const fallback = buildSimulatedHealth(this.channel);
      return {
        healthy: false,
        latencyMs: Date.now() - start || fallback.latencyMs,
        reason: "DoorDash health request failed"
      };
    }
  }
}
