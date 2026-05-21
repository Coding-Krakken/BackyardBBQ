import type { PaymentStatus } from "@prisma/client";

export const EPOS_WEBHOOK_EVENT_NAME_BY_TYPE: Record<number, string> = {
  304: "CompleteTransaction",
  305: "CreateOrderedTransaction",
  308: "CancelOrderedTransaction",
  309: "DeleteTransaction",
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

export function parseEposWebhookPayload(rawBody: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const payload = asRecord(parsed);
  const nestedPayload = asRecord(payload.payload);
  const transaction = asRecord(payload.transaction);
  const nestedTransaction = asRecord(nestedPayload.transaction);

  const eventType = firstNumber(
    payload.eventType,
    payload.webhookEventType,
    nestedPayload.eventType,
    nestedPayload.webhookEventType
  );

  const eventId = firstString(
    payload.eventId,
    payload.id,
    nestedPayload.eventId,
    nestedPayload.id,
    transaction.id,
    nestedTransaction.id
  );

  const referenceCode = firstString(
    payload.referenceCode,
    payload.transactionReferenceCode,
    nestedPayload.referenceCode,
    nestedPayload.transactionReferenceCode,
    transaction.referenceCode,
    transaction.transactionReferenceCode,
    nestedTransaction.referenceCode,
    nestedTransaction.transactionReferenceCode,
    payload.ReferenceCode,
    payload.TransactionReferenceCode,
    nestedPayload.ReferenceCode,
    nestedPayload.TransactionReferenceCode,
    transaction.ReferenceCode,
    transaction.TransactionReferenceCode,
    nestedTransaction.ReferenceCode,
    nestedTransaction.TransactionReferenceCode
  );

  const statusId = firstNumber(
    payload.statusId,
    nestedPayload.statusId,
    transaction.statusId,
    nestedTransaction.statusId,
    payload.StatusId,
    nestedPayload.StatusId,
    transaction.StatusId,
    nestedTransaction.StatusId
  );

  const totalAmount = firstNumber(
    payload.totalAmount,
    nestedPayload.totalAmount,
    transaction.totalAmount,
    nestedTransaction.totalAmount,
    payload.TotalAmount,
    nestedPayload.TotalAmount,
    transaction.TotalAmount,
    nestedTransaction.TotalAmount
  );

  return {
    payload,
    eventType,
    eventId,
    referenceCode,
    statusId,
    totalAmount,
  };
}

export function mapEposTransactionStatusToPaymentStatus(input: {
  eventType?: number;
  statusId?: number;
}): PaymentStatus {
  if (input.eventType === 304 || input.statusId === 1) {
    return "succeeded";
  }

  if (input.eventType === 308 || input.eventType === 309) {
    return "canceled";
  }

  if (input.eventType === 305 || input.statusId === 7 || input.statusId === 8) {
    return "processing";
  }

  return "processing";
}
