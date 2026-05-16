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

export class UberEatsClient implements DeliveryProviderClient {
  readonly channel = "ubereats" as const;

  constructor(private readonly credentials: DeliveryProviderCredentials) {}

  async verifyWebhookSignature(input: InboundWebhookValidationInput): Promise<boolean> {
    return Boolean(input.signature && this.credentials.webhookSecret);
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
