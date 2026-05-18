import { z } from "zod";

export const locationTypeSchema = z.enum(["truck", "brick-and-mortar"]);

export const orderSourceSchema = z.enum([
  "direct",
  "doordash",
  "ubereats",
  "grubhub",
  "catering"
]);

export const deliveryChannelSchema = z.enum(["doordash", "ubereats", "grubhub"]);

export const deliveryCredentialEnvironmentSchema = z.enum(["sandbox", "production"]);

export const deliveryProviderCredentialSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  merchantId: z.string().optional(),
  storeId: z.string().optional(),
  environment: deliveryCredentialEnvironmentSchema.default("sandbox")
});

export const deliveryProviderCredentialSetSchema = z.object({
  doordash: deliveryProviderCredentialSchema.optional(),
  ubereats: deliveryProviderCredentialSchema.optional(),
  grubhub: deliveryProviderCredentialSchema.optional()
});

export const fulfillmentModeSchema = z.enum(["delivery", "pickup"]);

export const fulfillmentSpeedSchema = z.enum(["asap", "scheduled"]);

export const deliveryOrderStatusSchema = z.enum([
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled"
]);

export const deliveryAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  postalCode: z.string().min(5),
  country: z.string().default("US")
});

export const deliveryOrderItemSchema = z.object({
  externalItemId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPriceCents: z.number().int().min(0),
  notes: z.string().optional()
});

export const inboundDeliveryOrderSchema = z.object({
  channel: deliveryChannelSchema,
  externalOrderId: z.string().min(1),
  externalStoreId: z.string().min(1),
  idempotencyKey: z.string().min(8),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  sourceCreatedAt: z.string().datetime(),
  fulfillmentMode: fulfillmentModeSchema,
  fulfillmentSpeed: fulfillmentSpeedSchema,
  scheduledFor: z.string().datetime().optional(),
  subtotalCents: z.number().int().min(0),
  taxCents: z.number().int().min(0),
  tipCents: z.number().int().min(0),
  feesCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
  deliveryAddress: deliveryAddressSchema.optional(),
  items: z.array(deliveryOrderItemSchema).min(1),
  metadata: z.record(z.unknown()).optional()
});

export const outboundDeliveryStatusUpdateSchema = z.object({
  channel: deliveryChannelSchema,
  externalOrderId: z.string().min(1),
  status: deliveryOrderStatusSchema,
  occurredAt: z.string().datetime(),
  reason: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  estimatedDeliveryAt: z.string().datetime().optional()
});

export const deliveryWebhookEnvelopeSchema = z.object({
  channel: deliveryChannelSchema,
  eventType: z.string().min(1),
  eventId: z.string().min(1),
  receivedAt: z.string().datetime(),
  payload: z.record(z.unknown())
});

export const deliverySettlementLineSchema = z.object({
  externalOrderId: z.string().min(1),
  grossCents: z.number().int(),
  feesCents: z.number().int(),
  adjustmentsCents: z.number().int(),
  netCents: z.number().int(),
  metadata: z.record(z.unknown()).optional()
});

export const deliverySettlementBatchSchema = z.object({
  channel: deliveryChannelSchema,
  externalBatchId: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  payoutAt: z.string().datetime().optional(),
  lines: z.array(deliverySettlementLineSchema).default([])
});

export type LocationType = z.infer<typeof locationTypeSchema>;
export type OrderSource = z.infer<typeof orderSourceSchema>;
export type DeliveryChannel = z.infer<typeof deliveryChannelSchema>;
export type DeliveryCredentialEnvironment = z.infer<typeof deliveryCredentialEnvironmentSchema>;
export type DeliveryProviderCredential = z.infer<typeof deliveryProviderCredentialSchema>;
export type DeliveryProviderCredentialSet = z.infer<typeof deliveryProviderCredentialSetSchema>;
export type FulfillmentMode = z.infer<typeof fulfillmentModeSchema>;
export type FulfillmentSpeed = z.infer<typeof fulfillmentSpeedSchema>;
export type DeliveryOrderStatus = z.infer<typeof deliveryOrderStatusSchema>;
export type InboundDeliveryOrder = z.infer<typeof inboundDeliveryOrderSchema>;
export type OutboundDeliveryStatusUpdate = z.infer<typeof outboundDeliveryStatusUpdateSchema>;
export type DeliveryWebhookEnvelope = z.infer<typeof deliveryWebhookEnvelopeSchema>;
export type DeliverySettlementBatch = z.infer<typeof deliverySettlementBatchSchema>;

export interface CateringInquiry {
  date: string;
  partySize: number;
  location: string;
}

// Re-export payment status constants
export * from "./constants";
