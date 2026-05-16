import {
  DoorDashClient,
  GrubhubClient,
  UberEatsClient,
  type DeliveryProviderClient,
  type DeliveryProviderCredentials,
  type ProviderHealthSnapshot,
  type ProviderMenuSnapshot,
  type ProviderStatusSyncInput
} from "./clients/index";

export * from "./clients/index";

export const deliveryChannels = ["doordash", "ubereats", "grubhub"] as const;

export type DeliveryChannel = (typeof deliveryChannels)[number];

export type RetryPolicy = {
  maxAttempts: number;
  backoffBaseMs: number;
  backoffMultiplier: number;
};

export type InboundOrderItem = {
  name: string;
  quantity: number;
};

export type InboundOrderEnvelope = {
  channel: DeliveryChannel;
  externalOrderId: string;
  idempotencyKey: string;
  totalCents: number;
  placedAt: string;
  items: InboundOrderItem[];
};

export type AdapterIngestStatus =
  | "processed"
  | "duplicate"
  | "retry_exhausted"
  | "terminal_failure";

export type AdapterIngestResult = {
  status: AdapterIngestStatus;
  attempts: number;
  latencyMs: number;
  reason?: string;
};

export type AdapterWebhookValidationInput = {
  signature?: string;
  rawBody: string;
};

export interface DeliveryChannelAdapter {
  readonly channel: DeliveryChannel;
  ingestOrder(envelope: InboundOrderEnvelope): Promise<AdapterIngestResult>;
  verifyWebhookSignature(input: AdapterWebhookValidationInput): Promise<boolean>;
  syncOrderStatus(input: ProviderStatusSyncInput): Promise<{ latencyMs: number }>;
  publishMenuSnapshot(snapshot: ProviderMenuSnapshot): Promise<{ latencyMs: number }>;
  checkHealth(): Promise<ProviderHealthSnapshot>;
}

type AdapterConfig = {
  retryableFailureThreshold: number;
  terminalFailureThreshold: number;
  latencyFloorMs: number;
  latencyCeilingMs: number;
};

const defaultAdapterConfig: Record<DeliveryChannel, AdapterConfig> = {
  doordash: {
    retryableFailureThreshold: 26,
    terminalFailureThreshold: 7,
    latencyFloorMs: 110,
    latencyCeilingMs: 370
  },
  ubereats: {
    retryableFailureThreshold: 21,
    terminalFailureThreshold: 5,
    latencyFloorMs: 130,
    latencyCeilingMs: 440
  },
  grubhub: {
    retryableFailureThreshold: 31,
    terminalFailureThreshold: 9,
    latencyFloorMs: 140,
    latencyCeilingMs: 520
  }
};

const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  backoffBaseMs: 120,
  backoffMultiplier: 2
};

class InMemoryIdempotencyStore {
  private readonly seenKeys = new Set<string>();

  has(key: string) {
    return this.seenKeys.has(key);
  }

  markProcessed(key: string) {
    this.seenKeys.add(key);
  }
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000003;
  }
  return hash;
}

function evaluateAttempt(
  envelope: InboundOrderEnvelope,
  channelConfig: AdapterConfig,
  attempt: number
): { outcome: "success" | "retryable_failure" | "terminal_failure"; latencyMs: number } {
  const score = stableHash(`${envelope.channel}:${envelope.externalOrderId}:${attempt}`) % 100;

  const latencySpread = Math.max(1, channelConfig.latencyCeilingMs - channelConfig.latencyFloorMs);
  const latencyMs =
    channelConfig.latencyFloorMs +
    (stableHash(`${envelope.idempotencyKey}:${attempt}:latency`) % latencySpread);

  if (score < channelConfig.terminalFailureThreshold) {
    return { outcome: "terminal_failure", latencyMs };
  }

  if (score < channelConfig.retryableFailureThreshold) {
    return { outcome: "retryable_failure", latencyMs };
  }

  return { outcome: "success", latencyMs };
}

class ProviderBackedDeliveryAdapter implements DeliveryChannelAdapter {
  readonly channel: DeliveryChannel;

  private readonly providerClient: DeliveryProviderClient;
  private readonly config: AdapterConfig;
  private readonly retryPolicy: RetryPolicy;
  private readonly idempotencyStore: InMemoryIdempotencyStore;

  constructor(input: {
    channel: DeliveryChannel;
    providerClient: DeliveryProviderClient;
    config: AdapterConfig;
    retryPolicy: RetryPolicy;
    idempotencyStore: InMemoryIdempotencyStore;
  }) {
    this.channel = input.channel;
    this.providerClient = input.providerClient;
    this.config = input.config;
    this.retryPolicy = input.retryPolicy;
    this.idempotencyStore = input.idempotencyStore;
  }

  async ingestOrder(envelope: InboundOrderEnvelope): Promise<AdapterIngestResult> {
    if (this.idempotencyStore.has(envelope.idempotencyKey)) {
      return {
        status: "duplicate",
        attempts: 1,
        latencyMs: 18
      };
    }

    let attempts = 0;
    let totalLatencyMs = 0;

    for (attempts = 1; attempts <= this.retryPolicy.maxAttempts; attempts += 1) {
      const attemptResult = evaluateAttempt(envelope, this.config, attempts);
      totalLatencyMs += attemptResult.latencyMs;

      if (attemptResult.outcome === "success") {
        this.idempotencyStore.markProcessed(envelope.idempotencyKey);
        return {
          status: "processed",
          attempts,
          latencyMs: totalLatencyMs
        };
      }

      if (attemptResult.outcome === "terminal_failure") {
        return {
          status: "terminal_failure",
          attempts,
          latencyMs: totalLatencyMs,
          reason: "Provider rejected payload as invalid"
        };
      }

      totalLatencyMs +=
        this.retryPolicy.backoffBaseMs * Math.pow(this.retryPolicy.backoffMultiplier, attempts - 1);
    }

    return {
      status: "retry_exhausted",
      attempts: this.retryPolicy.maxAttempts,
      latencyMs: totalLatencyMs,
      reason: "Provider timed out across all retry attempts"
    };
  }

  async verifyWebhookSignature(input: AdapterWebhookValidationInput): Promise<boolean> {
    return this.providerClient.verifyWebhookSignature(input);
  }

  async syncOrderStatus(input: ProviderStatusSyncInput): Promise<{ latencyMs: number }> {
    const start = Date.now();
    await this.providerClient.syncOrderStatus(input);
    return { latencyMs: Date.now() - start };
  }

  async publishMenuSnapshot(snapshot: ProviderMenuSnapshot): Promise<{ latencyMs: number }> {
    const start = Date.now();
    await this.providerClient.publishMenuSnapshot(snapshot);
    return { latencyMs: Date.now() - start };
  }

  async checkHealth(): Promise<ProviderHealthSnapshot> {
    return this.providerClient.checkHealth();
  }
}

function createProviderClients(
  credentialsByChannel: Partial<Record<DeliveryChannel, DeliveryProviderCredentials>>
): Record<DeliveryChannel, DeliveryProviderClient> {
  return {
    doordash: new DoorDashClient(credentialsByChannel.doordash ?? { apiKey: "" }),
    ubereats: new UberEatsClient(credentialsByChannel.ubereats ?? { apiKey: "" }),
    grubhub: new GrubhubClient(credentialsByChannel.grubhub ?? { apiKey: "" })
  };
}

export function createDeliveryChannelAdapters(input?: {
  retryPolicy?: Partial<RetryPolicy>;
  credentialsByChannel?: Partial<Record<DeliveryChannel, DeliveryProviderCredentials>>;
}): Record<DeliveryChannel, DeliveryChannelAdapter> {
  const retryPolicy: RetryPolicy = {
    ...defaultRetryPolicy,
    ...(input?.retryPolicy ?? {})
  };
  const idempotencyStore = new InMemoryIdempotencyStore();
  const providerClients = createProviderClients(input?.credentialsByChannel ?? {});

  return {
    doordash: new ProviderBackedDeliveryAdapter({
      channel: "doordash",
      providerClient: providerClients.doordash,
      config: defaultAdapterConfig.doordash,
      retryPolicy,
      idempotencyStore
    }),
    ubereats: new ProviderBackedDeliveryAdapter({
      channel: "ubereats",
      providerClient: providerClients.ubereats,
      config: defaultAdapterConfig.ubereats,
      retryPolicy,
      idempotencyStore
    }),
    grubhub: new ProviderBackedDeliveryAdapter({
      channel: "grubhub",
      providerClient: providerClients.grubhub,
      config: defaultAdapterConfig.grubhub,
      retryPolicy,
      idempotencyStore
    })
  };
}
