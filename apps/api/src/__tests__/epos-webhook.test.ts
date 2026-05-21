/** @jest-environment node */

import {
  EPOS_WEBHOOK_EVENT_NAME_BY_TYPE,
  mapEposTransactionStatusToPaymentStatus,
  parseEposWebhookPayload
} from "../webhook/epos";

describe("EPOS webhook helpers", () => {
  describe("EPOS_WEBHOOK_EVENT_NAME_BY_TYPE", () => {
    it("contains documented transaction lifecycle event mappings", () => {
      expect(EPOS_WEBHOOK_EVENT_NAME_BY_TYPE[304]).toBe("CompleteTransaction");
      expect(EPOS_WEBHOOK_EVENT_NAME_BY_TYPE[305]).toBe("CreateOrderedTransaction");
      expect(EPOS_WEBHOOK_EVENT_NAME_BY_TYPE[308]).toBe("CancelOrderedTransaction");
      expect(EPOS_WEBHOOK_EVENT_NAME_BY_TYPE[309]).toBe("DeleteTransaction");
    });
  });

  describe("parseEposWebhookPayload", () => {
    it("returns null for invalid JSON", () => {
      expect(parseEposWebhookPayload("{not-json")).toBeNull();
    });

    it("extracts event and transaction fields from top-level payload", () => {
      const parsed = parseEposWebhookPayload(
        JSON.stringify({
          eventType: 304,
          eventId: "evt_304",
          referenceCode: "order_123",
          statusId: 1,
          totalAmount: 41.5,
        })
      );

      expect(parsed).toEqual(
        expect.objectContaining({
          eventType: 304,
          eventId: "evt_304",
          referenceCode: "order_123",
          statusId: 1,
          totalAmount: 41.5,
        })
      );
    });

    it("extracts fallback fields from nested payload and transaction objects", () => {
      const parsed = parseEposWebhookPayload(
        JSON.stringify({
          payload: {
            webhookEventType: "305",
            transaction: {
              id: "txn_999",
              ReferenceCode: "order_999",
              StatusId: "8",
              TotalAmount: "27.10",
            },
          },
        })
      );

      expect(parsed).toEqual(
        expect.objectContaining({
          eventType: 305,
          eventId: "txn_999",
          referenceCode: "order_999",
          statusId: 8,
          totalAmount: 27.1,
        })
      );
    });

    it("extracts reference code from TransactionReferenceCode aliases", () => {
      const parsed = parseEposWebhookPayload(
        JSON.stringify({
          payload: {
            eventType: 304,
            transaction: {
              TransactionReferenceCode: "booking:bk_123",
            },
          },
        })
      );

      expect(parsed).toEqual(
        expect.objectContaining({
          referenceCode: "booking:bk_123",
        })
      );
    });
  });

  describe("mapEposTransactionStatusToPaymentStatus", () => {
    it("maps completion event/status to succeeded", () => {
      expect(mapEposTransactionStatusToPaymentStatus({ eventType: 304 })).toBe("succeeded");
      expect(mapEposTransactionStatusToPaymentStatus({ statusId: 1 })).toBe("succeeded");
    });

    it("maps cancel/delete events to canceled", () => {
      expect(mapEposTransactionStatusToPaymentStatus({ eventType: 308 })).toBe("canceled");
      expect(mapEposTransactionStatusToPaymentStatus({ eventType: 309 })).toBe("canceled");
    });

    it("maps ordered/held states to processing", () => {
      expect(mapEposTransactionStatusToPaymentStatus({ eventType: 305 })).toBe("processing");
      expect(mapEposTransactionStatusToPaymentStatus({ statusId: 7 })).toBe("processing");
      expect(mapEposTransactionStatusToPaymentStatus({ statusId: 8 })).toBe("processing");
      expect(mapEposTransactionStatusToPaymentStatus({})).toBe("processing");
    });

    it("falls back to processing for unknown status/event combinations", () => {
      expect(mapEposTransactionStatusToPaymentStatus({ eventType: 999, statusId: 999 })).toBe("processing");
    });
  });
});
