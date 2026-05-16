import type { DeliveryChannel, ProviderStatusSyncInput } from "./base-client";

export type ProviderActionPayload = {
  providerStatus: string;
  providerReasonCode?: string;
};

const defaultReasonCodeByStatus: Partial<Record<ProviderStatusSyncInput["status"], string>> = {
  accepted: "ACCEPTED_BY_MERCHANT",
  preparing: "IN_PREPARATION",
  ready: "READY_FOR_HANDOFF",
  out_for_delivery: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  cancelled: "CANCELLED_BY_MERCHANT"
};

const providerStatusMaps: Record<DeliveryChannel, Record<ProviderStatusSyncInput["status"], string>> = {
  doordash: {
    accepted: "accepted",
    preparing: "preparing",
    ready: "ready_for_pickup",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered",
    cancelled: "cancelled"
  },
  ubereats: {
    accepted: "accepted",
    preparing: "in_progress",
    ready: "ready",
    out_for_delivery: "courier_en_route",
    delivered: "completed",
    cancelled: "cancelled"
  },
  grubhub: {
    accepted: "confirmed",
    preparing: "preparing",
    ready: "ready",
    out_for_delivery: "in_transit",
    delivered: "fulfilled",
    cancelled: "cancelled"
  }
};

export function mapProviderActionPayload(input: {
  channel: DeliveryChannel;
  status: ProviderStatusSyncInput["status"];
  reason?: string;
}): ProviderActionPayload {
  const providerStatus = providerStatusMaps[input.channel][input.status];
  const providerReasonCode = input.reason
    ? input.reason.slice(0, 120)
    : defaultReasonCodeByStatus[input.status];

  return {
    providerStatus,
    providerReasonCode
  };
}
