import {
  buildSimulatedHealth,
  type DeliveryProviderClient,
  type DeliveryProviderCredentials,
  type InboundWebhookValidationInput,
  type ProviderHealthSnapshot,
  type ProviderInboundOrder,
  type ProviderMenuSnapshot,
  type ProviderStatusSyncInput
} from "./base-client";

export class DoorDashClient implements DeliveryProviderClient {
  readonly channel = "doordash" as const;

  constructor(private readonly credentials: DeliveryProviderCredentials) {}

  async verifyWebhookSignature(input: InboundWebhookValidationInput): Promise<boolean> {
    return Boolean(input.signature && this.credentials.webhookSecret);
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
    return;
  }

  async publishMenuSnapshot(_snapshot: ProviderMenuSnapshot): Promise<void> {
    return;
  }

  async checkHealth(): Promise<ProviderHealthSnapshot> {
    return buildSimulatedHealth(this.channel);
  }
}
