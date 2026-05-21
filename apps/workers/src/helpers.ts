import { Prisma } from "@bbq/database";
import { deliveryChannels, type DeliveryChannel, type ProviderStatusSyncInput } from "@bbq/delivery-channels";

export function mapInternalToProviderStatus(status: string): ProviderStatusSyncInput["status"] | null {
  switch (status) {
    case "confirmed":
      return "accepted";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "completed":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

export function getPayloadCorrelationId(payload: Prisma.JsonObject, fallback: string) {
  const correlationId = payload.correlationId;
  return typeof correlationId === "string" && correlationId.length > 0 ? correlationId : fallback;
}

export function getEventCorrelationId(
  event: { correlationId?: string | null; payload: Prisma.JsonValue },
  fallback: string
) {
  if (typeof event.correlationId === "string" && event.correlationId.length > 0) {
    return event.correlationId;
  }

  const payload = event.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  return getPayloadCorrelationId(payload as Prisma.JsonObject, fallback);
}

export type IncomingWebhookOrder = {
  externalOrderId: string;
  source: DeliveryChannel;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
    notes?: string;
  }>;
};

export type IncomingWebhookStatusUpdate = {
  internalOrderId?: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
};

export function parseWebhookOrderPayload(payload: Prisma.JsonObject): IncomingWebhookOrder | null {
  const orderValue = payload.order;
  if (!orderValue || typeof orderValue !== "object" || Array.isArray(orderValue)) {
    return null;
  }

  const order = orderValue as Prisma.JsonObject;
  const externalOrderId = typeof order.externalOrderId === "string" ? order.externalOrderId : null;
  const source = typeof order.source === "string" ? (order.source as DeliveryChannel) : null;
  const subtotalCents = typeof order.subtotalCents === "number" ? order.subtotalCents : null;
  const taxCents = typeof order.taxCents === "number" ? order.taxCents : 0;
  const tipCents = typeof order.tipCents === "number" ? order.tipCents : 0;
  const totalCents = typeof order.totalCents === "number" ? order.totalCents : null;
  const itemsValue = order.items;

  if (!externalOrderId || !source || !deliveryChannels.includes(source) || subtotalCents === null || totalCents === null) {
    return null;
  }

  if (!Array.isArray(itemsValue) || itemsValue.length === 0) {
    return null;
  }

  const items: IncomingWebhookOrder["items"] = [];
  for (const item of itemsValue) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const row = item as Prisma.JsonObject;
    const name = typeof row.name === "string" ? row.name : null;
    const quantity = typeof row.quantity === "number" ? row.quantity : null;
    const unitPriceCents = typeof row.unitPriceCents === "number" ? row.unitPriceCents : null;
    const notes = typeof row.notes === "string" ? row.notes : undefined;

    if (!name || quantity === null || unitPriceCents === null) {
      continue;
    }

    items.push({ name, quantity, unitPriceCents, notes });
  }

  if (items.length === 0) {
    return null;
  }

  return {
    externalOrderId,
    source,
    subtotalCents,
    taxCents,
    tipCents,
    totalCents,
    items
  };
}

export function parseWebhookStatusPayload(payload: Prisma.JsonObject): IncomingWebhookStatusUpdate | null {
  const statusValue = payload.statusUpdate;
  if (!statusValue || typeof statusValue !== "object" || Array.isArray(statusValue)) {
    return null;
  }

  const statusUpdate = statusValue as Prisma.JsonObject;
  const status = typeof statusUpdate.status === "string" ? statusUpdate.status : null;
  const internalOrderId =
    typeof statusUpdate.internalOrderId === "string" ? statusUpdate.internalOrderId : undefined;

  if (
    status !== "pending" &&
    status !== "confirmed" &&
    status !== "preparing" &&
    status !== "ready" &&
    status !== "completed" &&
    status !== "cancelled"
  ) {
    return null;
  }

  return {
    internalOrderId,
    status
  };
}

export function extractSettlementPayload(payload: Prisma.JsonObject) {
  const direct = payload.settlement;
  const nestedPayload = payload.payload;
  const nestedRecord =
    nestedPayload && typeof nestedPayload === "object" && !Array.isArray(nestedPayload)
      ? (nestedPayload as Prisma.JsonObject)
      : undefined;

  const nested = nestedRecord?.settlement ?? nestedRecord;
  const candidate =
    direct && typeof direct === "object" && !Array.isArray(direct)
      ? (direct as Prisma.JsonObject)
      : nested && typeof nested === "object" && !Array.isArray(nested)
        ? (nested as Prisma.JsonObject)
        : undefined;

  if (!candidate) {
    return null;
  }

  const settlementId = typeof candidate.settlementId === "string" ? candidate.settlementId : undefined;
  const grossCents = typeof candidate.grossCents === "number" ? candidate.grossCents : undefined;
  const feesCents = typeof candidate.feesCents === "number" ? candidate.feesCents : 0;
  const netCents = typeof candidate.netCents === "number" ? candidate.netCents : undefined;
  const currency = typeof candidate.currency === "string" ? candidate.currency : "usd";
  const payoutId = typeof candidate.payoutId === "string" ? candidate.payoutId : undefined;
  const externalOrderId =
    typeof candidate.externalOrderId === "string"
      ? candidate.externalOrderId
      : typeof payload.orderExternalId === "string"
        ? payload.orderExternalId
        : undefined;
  const settledAt =
    typeof candidate.settledAt === "string"
      ? candidate.settledAt
      : typeof payload.receivedAt === "string"
        ? payload.receivedAt
        : new Date().toISOString();

  if (!settlementId || typeof grossCents !== "number" || typeof netCents !== "number") {
    return null;
  }

  return {
    settlementId,
    payoutId,
    externalOrderId,
    grossCents,
    feesCents,
    netCents,
    currency,
    settledAt
  };
}
