/** @jest-environment node */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../../../lib/prisma";
import { clearRateLimitStore } from "../../../../../lib/rate-limit";
import { POST } from "../route";
import { TEST_STRIPE_SECRET_KEY } from "../../__tests__/test-constants";

var mockCheckoutSessionsCreate: jest.Mock;
var mockCustomersCreate: jest.Mock;

jest.mock("stripe", () => {
  mockCheckoutSessionsCreate = jest.fn();
  mockCustomersCreate = jest.fn();

  const StripeMock = jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    },
    customers: {
      create: mockCustomersCreate,
    },
  }));

  return {
    __esModule: true,
    default: StripeMock,
  };
});

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("POST /api/payments/create-checkout-session", () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = TEST_STRIPE_SECRET_KEY;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearRateLimitStore();
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  it("returns 400 for invalid payload", async () => {
    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 10 }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid checkout payload");
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when subtotal and amount drift", async () => {
    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1200,
        currency: "usd",
        metadata: { subtotalCents: 1000, orderId: "ord_1" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Subtotal validation failed");
    expect(payload.details.expectedAmountCents).toBe(1000);
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("allows amount to include tip when metadata.tipCents is provided", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_tip",
      id: "cs_test_tip_1",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1300,
        currency: "usd",
        metadata: { subtotalCents: 1000, tipCents: 300, orderId: "ord_tip_1" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 1000,
              product_data: expect.objectContaining({ name: "Backyard BBQ Order" }),
            }),
          }),
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 300,
              product_data: expect.objectContaining({ name: "Tip" }),
            }),
          }),
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 80,
              product_data: expect.objectContaining({ name: "Sales Tax" }),
            }),
          }),
        ]),
      }),
      undefined
    );
  });

  it("returns 400 for invalid checkout metadata", async () => {
    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1000,
        currency: "usd",
        metadata: { idempotencyKey: "short", orderId: "ord_meta_invalid" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid checkout metadata");
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("reuses existing stripe customer when available", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_1", email: "pitmaster@example.com" },
    });

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_1",
      email: "pitmaster@example.com",
      firstName: "Pit",
      lastName: "Master",
      stripeCustomerId: "cus_existing",
    } as never);

    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret",
      id: "cs_test_123",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 2000,
        currency: "usd",
        metadata: { subtotalCents: 2000, orderId: "ord_2" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sessionId).toBe("cs_test_123");
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 2000,
              product_data: expect.objectContaining({ name: "Backyard BBQ Order" }),
            }),
          }),
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 160,
              product_data: expect.objectContaining({ name: "Sales Tax" }),
            }),
          }),
        ]),
        metadata: expect.objectContaining({
          source: "web-checkout",
          orderId: "ord_2",
        }),
      }),
      undefined
    );
  });

  it("creates and persists stripe customer for signed-in user missing one", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_2", email: "smoke@example.com" },
    });

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_2",
      email: "smoke@example.com",
      firstName: "Smoke",
      lastName: "Ring",
      stripeCustomerId: null,
    } as never);

    const updateSpy = jest
      .spyOn(prisma.customer, "update")
      .mockResolvedValue({ id: "cust_2", stripeCustomerId: "cus_new" } as never);

    mockCustomersCreate.mockResolvedValue({ id: "cus_new" });
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_2",
      id: "cs_test_456",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1500,
        currency: "usd",
        metadata: { subtotalCents: 1500, orderId: "ord_3" },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "smoke@example.com",
        metadata: { customerId: "cust_2" },
      })
    );
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "cust_2" },
      data: { stripeCustomerId: "cus_new" },
    });
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new",
        payment_intent_data: expect.objectContaining({
          setup_future_usage: "off_session",
        }),
      }),
      undefined
    );
  });

  it("passes request idempotency key to Stripe", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_3",
      id: "cs_test_789",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "checkout-idem-12345",
      },
      body: JSON.stringify({
        amountCents: 1800,
        currency: "usd",
        metadata: { subtotalCents: 1800, orderId: "ord_4" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
      }),
      { idempotencyKey: "checkout-idem-12345" }
    );
  });

  it("uses metadata idempotency key when request header key is missing", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_4",
      id: "cs_test_101",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        amountCents: 2100,
        currency: "usd",
        metadata: {
          subtotalCents: 2100,
          idempotencyKey: "checkout-metadata-idem-123",
          orderId: "ord_5",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
      }),
      { idempotencyKey: "checkout-metadata-idem-123" }
    );
  });

  it("logs a warning when client tax drift exceeds threshold", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_5",
      id: "cs_test_102",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1000,
        currency: "usd",
        metadata: {
          subtotalCents: 1000,
          clientTaxCents: 20,
          orderId: "ord_drift_warn",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(
      "Checkout tax drift warning",
      expect.objectContaining({
        subtotalCents: 1000,
        clientTaxCents: 20,
      })
    );
  });

  it("returns 500 when Stripe session creation throws", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockRejectedValue(new Error("Stripe unavailable"));

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 2200,
        currency: "usd",
        metadata: { subtotalCents: 2200, orderId: "ord_6" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Stripe unavailable");
  });

  it("enforces checkout rate limiting by IP", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_rl",
      id: "cs_test_rl",
    });

    let lastStatus = 200;
    for (let index = 0; index < 11; index += 1) {
      const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.42",
        },
        body: JSON.stringify({
          amountCents: 1900,
          currency: "usd",
          metadata: { subtotalCents: 1900, orderId: `ord_rl_${index}` },
        }),
      });

      const response = await POST(request);
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(10);
  });
});
