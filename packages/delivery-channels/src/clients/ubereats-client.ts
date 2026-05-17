import {
  buildSimulatedHealth,
  type DeliveryProviderClient,
  type DeliveryProviderCredentials,
  type InboundWebhookValidationInput,
  performProviderRequest,
  type ProviderDispatchInput,
  type ProviderHealthSnapshot,
  type ProviderInboundOrder,
  type ProviderMenuSnapshot,
  type ProviderOrderActionInput,
  type ProviderStatusSyncInput,
  verifyWebhookHmac
} from "./base-client";
import { mapProviderActionPayload } from "./status-mapping";

export class UberEatsClient implements DeliveryProviderClient {
  readonly channel = "ubereats" as const;

  private readonly baseUrl: string;

  constructor(private readonly credentials: DeliveryProviderCredentials) {
    this.baseUrl = process.env.UBEREATS_API_BASE_URL?.trim() || "https://api.uber.com";
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
      throw new Error("UberEats payload missing external order id");
    }

    return {
      externalOrderId,
      idempotencyKey: `ubereats:${externalOrderId}`,
      totalCents: Number(payload.totalCents ?? 0),
      placedAt: new Date().toISOString(),
      items: []
    };
  }

  async dispatchOrder(input: ProviderDispatchInput): Promise<void> {
    await this.syncOrderStatus({
      externalOrderId: input.externalOrderId,
      status: "accepted",
      occurredAt: input.occurredAt
    });
  }

  async sendOrderAction(input: ProviderOrderActionInput): Promise<void> {
    const mappedStatusByAction: Record<ProviderOrderActionInput["action"], ProviderStatusSyncInput["status"]> = {
      accept: "accepted",
      reject: "cancelled",
      cancel: "cancelled",
      preparing: "preparing",
      ready: "ready",
      out_for_delivery: "out_for_delivery",
      delivered: "delivered"
    };

    await this.syncOrderStatus({
      externalOrderId: input.externalOrderId,
      status: mappedStatusByAction[input.action],
      reason: input.reason,
      occurredAt: input.occurredAt
    });
  }

  async syncOrderStatus(_input: ProviderStatusSyncInput): Promise<void> {
    if (!this.credentials.apiKey || !this.credentials.storeId) {
      return;
    }

    const mapped = mapProviderActionPayload({
      channel: this.channel,
      status: _input.status,
      reason: _input.reason
    });

    await performProviderRequest({
      url: `${this.baseUrl}/v1/eats/stores/${encodeURIComponent(this.credentials.storeId)}/orders/${encodeURIComponent(_input.externalOrderId)}/status`,
      method: "POST",
      apiKey: this.credentials.apiKey,
      body: {
        status: mapped.providerStatus,
        reasonCode: mapped.providerReasonCode,
        occurredAt: _input.occurredAt
      }
    });
  }

  async publishMenuSnapshot(_snapshot: ProviderMenuSnapshot): Promise<void> {
    if (!this.credentials.apiKey || !this.credentials.storeId) {
      return;
    }

    await performProviderRequest({
      url: `${this.baseUrl}/v1/eats/stores/${encodeURIComponent(this.credentials.storeId)}/menus`,
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
        reason: "UberEats credentials not configured"
      };
    }

    const start = Date.now();
    try {
      await performProviderRequest({
        url: `${this.baseUrl}/v1/eats/health`,
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
        reason: "UberEats health request failed"
      };
    }
  }
}
