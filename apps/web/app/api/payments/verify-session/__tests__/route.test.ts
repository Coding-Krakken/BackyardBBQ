/** @jest-environment node */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { TEST_STRIPE_SECRET_KEY } from "../../__tests__/test-constants";
import { prisma } from "../../../../../lib/prisma";

var mockCheckoutSessionsRetrieve: jest.Mock;

jest.mock("stripe", () => {
  mockCheckoutSessionsRetrieve = jest.fn();

  const StripeMock = jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        retrieve: mockCheckoutSessionsRetrieve,
      },
    },
  }));

  return {
    __esModule: true,
    default: StripeMock,
  };
});

describe("GET /api/payments/verify-session", () => {
  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = TEST_STRIPE_SECRET_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(prisma.paymentTransaction, "findUnique").mockResolvedValue(null as never);
  });

  it("returns 400 when session_id is missing", async () => {
    const request = new NextRequest("http://localhost/api/payments/verify-session", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Missing session_id parameter");
    expect(mockCheckoutSessionsRetrieve).not.toHaveBeenCalled();
  });

  it("returns mapped session details", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      customer_details: { email: "customer@example.com" },
      currency: "usd",
      amount_subtotal: 2000,
      total_details: { amount_tax: 160 },
      amount_total: 2160,
    });

    const request = new NextRequest("http://localhost/api/payments/verify-session?session_id=cs_123", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      status: "complete",
      paymentStatus: "paid",
      customerEmail: "customer@example.com",
      currency: "usd",
      amountSubtotal: 2000,
      amountTax: 160,
      amountTotal: 2160,
      orderId: null,
    });
    expect(mockCheckoutSessionsRetrieve).toHaveBeenCalledWith("cs_123");
  });

  it("falls back to zero tax when Stripe total details are absent", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      status: "open",
      payment_status: "unpaid",
      customer_details: { email: null },
      currency: "usd",
      amount_subtotal: 500,
      total_details: null,
      amount_total: 500,
    });

    const request = new NextRequest("http://localhost/api/payments/verify-session?session_id=cs_456", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.amountTax).toBe(0);
    expect(payload.orderId).toBeNull();
  });

  it("resolves orderId from session metadata when present", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      customer_details: { email: "guest@example.com" },
      currency: "usd",
      amount_subtotal: 1200,
      total_details: { amount_tax: 96 },
      amount_total: 1296,
      metadata: { orderId: "ord_meta_1" },
      payment_intent: "pi_meta_1",
    });

    const request = new NextRequest("http://localhost/api/payments/verify-session?session_id=cs_meta_1", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.orderId).toBe("ord_meta_1");
    expect(prisma.paymentTransaction.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to payment transaction lookup when metadata orderId is missing", async () => {
    (prisma.paymentTransaction.findUnique as jest.Mock).mockResolvedValue({ orderId: "ord_from_payment" });
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      customer_details: { email: "guest@example.com" },
      currency: "usd",
      amount_subtotal: 1200,
      total_details: { amount_tax: 96 },
      amount_total: 1296,
      metadata: {},
      payment_intent: "pi_lookup_1",
    });

    const request = new NextRequest("http://localhost/api/payments/verify-session?session_id=cs_lookup_1", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.orderId).toBe("ord_from_payment");
    expect(prisma.paymentTransaction.findUnique).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: "pi_lookup_1" },
      select: { orderId: true },
    });
  });

  it("returns 500 when Stripe retrieval throws", async () => {
    mockCheckoutSessionsRetrieve.mockRejectedValue(new Error("Stripe unavailable"));

    const request = new NextRequest("http://localhost/api/payments/verify-session?session_id=cs_789", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Stripe unavailable");
  });
});
