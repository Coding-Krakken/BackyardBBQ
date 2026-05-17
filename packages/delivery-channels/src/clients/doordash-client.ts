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
  type ProviderSettlementInput,
  type ProviderStatusSyncInput,
  verifyWebhookHmac
} from "./base-client";
import { createHmac } from "node:crypto";
import { mapProviderActionPayload } from "./status-mapping";

export class DoorDashClient implements DeliveryProviderClient {
  readonly channel = "doordash" as const;

  private readonly baseUrl: string;

  constructor(private readonly credentials: DeliveryProviderCredentials) {
    this.baseUrl = process.env.DOORDASH_API_BASE_URL?.trim() || "https://openapi.doordash.com";
  }

  private getDoorDashJwt(): string | null {
    const developerId = process.env.DOORDASH_DEVELOPER_ID?.trim();
    const keyId = this.credentials.apiKey?.trim();
    const signingSecret = this.credentials.apiSecret?.trim();

    if (!developerId || !keyId || !signingSecret) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: "HS256",
      typ: "JWT",
      "dd-ver": "DD-JWT-V1"
    };
    const payload = {
      aud: "doordash",
      iss: developerId,
      kid: keyId,
      iat: now,
      exp: now + 300
    };

    const base64Url = (value: string | Buffer) =>
      Buffer.from(value)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
    const secretBytes = Buffer.from(signingSecret, "base64url");
    const signature = createHmac("sha256", secretBytes).update(signingInput).digest();

    return `${signingInput}.${base64Url(signature)}`;
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
    if (!this.credentials.apiKey || !this.credentials.apiSecret || !this.credentials.storeId) {
      return;
    }

    const authToken = this.getDoorDashJwt();
    if (!authToken) {
      return;
    }

    const mapped = mapProviderActionPayload({
      channel: this.channel,
      status: _input.status,
      reason: _input.reason
    });

    await performProviderRequest({
      url: `${this.baseUrl}/drive/v2/stores/${encodeURIComponent(this.credentials.storeId)}/orders/${encodeURIComponent(_input.externalOrderId)}/status`,
      method: "POST",
      apiKey: authToken,
      body: {
        status: mapped.providerStatus,
        reasonCode: mapped.providerReasonCode,
        occurredAt: _input.occurredAt
      }
    });
  }

  async syncSettlement(input: ProviderSettlementInput): Promise<void> {
    if (!this.credentials.apiKey || !this.credentials.storeId) {
      return;
    }

    // DoorDash Drive settlement reconciliation is tracked internally from webhook data.
    // Keep this method as a no-op so worker settlement ledger persistence can complete.
    void input;
  }

  async publishMenuSnapshot(_snapshot: ProviderMenuSnapshot): Promise<void> {
    if (!this.credentials.apiKey || !this.credentials.apiSecret || !this.credentials.storeId) {
      return;
    }

    const authToken = this.getDoorDashJwt();
    if (!authToken) {
      return;
    }

    await performProviderRequest({
      url: `${this.baseUrl}/marketplace/v1/stores/${encodeURIComponent(this.credentials.storeId)}/menu`,
      method: "PUT",
      apiKey: authToken,
      body: {
        locationId: _snapshot.locationId,
        publishedAt: _snapshot.publishedAt,
        items: _snapshot.items
      }
    });
  }

  async checkHealth(): Promise<ProviderHealthSnapshot> {
    if (!this.credentials.apiKey || !this.credentials.apiSecret) {
      return {
        healthy: false,
        latencyMs: 0,
        reason: "DoorDash credentials not configured"
      };
    }

    const authToken = this.getDoorDashJwt();
    if (!authToken) {
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
        apiKey: authToken
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
