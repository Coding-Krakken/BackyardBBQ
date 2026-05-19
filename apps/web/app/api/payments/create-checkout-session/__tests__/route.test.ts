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
    jest.spyOn(prisma.location, "findFirst").mockResolvedValue({ id: "loc_test" } as never);
    jest.spyOn(prisma.order, "create").mockResolvedValue({ id: "ord_created_test" } as never);
    jest.spyOn(prisma.order, "delete").mockResolvedValue({ id: "ord_created_test" } as never);
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

  it("returns 500 when NEXT_PUBLIC_SITE_URL is missing", async () => {
    const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1000,
        currency: "usd",
        metadata: { subtotalCents: 1000, orderId: "ord_missing_site_url" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Server configuration error. Please contact support.");

    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("returns 500 when STRIPE_SECRET_KEY is missing", async () => {
    const originalSecretKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1000,
        currency: "usd",
        metadata: { subtotalCents: 1000, orderId: "ord_missing_stripe_secret" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Missing STRIPE_SECRET_KEY environment variable");

    process.env.STRIPE_SECRET_KEY = originalSecretKey;
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
          orderId: "ord_created_test",
        }),
      }),
      undefined
    );
  });

  it("uses server-created orderId even when metadata includes orderId", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_order_id",
      id: "cs_test_order_id",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1200,
        currency: "usd",
        metadata: { subtotalCents: 1200, orderId: "client_supplied_order" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.orderId).toBe("ord_created_test");
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ orderId: "ord_created_test" }),
        payment_intent_data: expect.objectContaining({
          metadata: expect.objectContaining({ orderId: "ord_created_test" }),
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

  it("continues as guest checkout when signed-in customer record is missing", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_missing", email: "missing@example.com" },
    });

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue(null as never);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_missing_customer",
      id: "cs_test_missing_customer",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1500,
        currency: "usd",
        metadata: { subtotalCents: 1500, orderId: "ord_missing_customer" },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: undefined,
      }),
      undefined
    );
  });

  it("creates Stripe customer using non-empty name parts only", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_partial_name", email: "partial@example.com" },
    });

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_partial_name",
      email: "partial@example.com",
      firstName: "",
      lastName: "Solo",
      stripeCustomerId: null,
    } as never);

    jest.spyOn(prisma.customer, "update").mockResolvedValue({
      id: "cust_partial_name",
      stripeCustomerId: "cus_partial_name",
    } as never);

    mockCustomersCreate.mockResolvedValue({ id: "cus_partial_name" });
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_partial_name",
      id: "cs_test_partial_name",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1800,
        currency: "usd",
        metadata: { subtotalCents: 1800, orderId: "ord_partial_name" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "partial@example.com",
        name: "Solo",
      })
    );
  });

  it("creates Stripe customer with undefined name when both names are empty", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_empty_name", email: "empty@example.com" },
    });

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_empty_name",
      email: "empty@example.com",
      firstName: "",
      lastName: "",
      stripeCustomerId: null,
    } as never);

    jest.spyOn(prisma.customer, "update").mockResolvedValue({
      id: "cust_empty_name",
      stripeCustomerId: "cus_empty_name",
    } as never);

    mockCustomersCreate.mockResolvedValue({ id: "cus_empty_name" });
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_empty_name",
      id: "cs_test_empty_name",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 2000,
        currency: "usd",
        metadata: { subtotalCents: 2000, orderId: "ord_empty_name" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "empty@example.com",
        name: undefined,
      })
    );
  });

  it("uses default server tax rate when SALES_TAX_RATE is unset", async () => {
    const originalSalesTaxRate = process.env.SALES_TAX_RATE;
    delete process.env.SALES_TAX_RATE;

    jest.resetModules();

    const localCheckoutCreate = jest.fn().mockResolvedValue({
      client_secret: "seti_client_secret_default_tax",
      id: "cs_test_default_tax",
    });
    const localCustomersCreate = jest.fn();
    const localGetServerSession = jest.fn().mockResolvedValue(null);

    jest.doMock("stripe", () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        checkout: { sessions: { create: localCheckoutCreate } },
        customers: { create: localCustomersCreate },
      })),
    }));
    jest.doMock("next-auth", () => ({ getServerSession: localGetServerSession }));

    const { prisma: mockedPrisma } = await import("../../../../../lib/prisma");
    jest.spyOn(mockedPrisma.location, "findFirst").mockResolvedValue({ id: "loc_test" } as never);
    jest.spyOn(mockedPrisma.order, "create").mockResolvedValue({ id: "ord_created_test" } as never);
    jest.spyOn(mockedPrisma.order, "delete").mockResolvedValue({ id: "ord_created_test" } as never);

    const { POST: isolatedPost } = await import("../route");

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1000,
        currency: "usd",
        metadata: { subtotalCents: 1000, orderId: "ord_default_tax" },
      }),
    });

    const response = await isolatedPost(request);

    expect(response.status).toBe(200);
    expect(localCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 80,
            }),
          }),
        ]),
      }),
      undefined
    );

    if (typeof originalSalesTaxRate === "string") {
      process.env.SALES_TAX_RATE = originalSalesTaxRate;
    } else {
      delete process.env.SALES_TAX_RATE;
    }
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

  it("does not warn on drift when estimated server tax is zero", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_zero_tax",
      id: "cs_test_zero_tax",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 50,
        currency: "usd",
        metadata: {
          subtotalCents: 0,
          tipCents: 50,
          clientTaxCents: 99,
          orderId: "ord_zero_estimated_tax",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("skips customer lookup when session user email is missing", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_no_email" } });
    const findUniqueSpy = jest.spyOn(prisma.customer, "findUnique");

    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_no_email",
      id: "cs_test_no_email",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1500,
        currency: "usd",
        metadata: { subtotalCents: 1500, orderId: "ord_no_email" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(findUniqueSpy).not.toHaveBeenCalled();
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
    expect(prisma.order.delete).toHaveBeenCalledWith({ where: { id: "ord_created_test" } });
  });

  it("returns Stripe error when cleanup delete also fails", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockRejectedValue(new Error("Stripe unavailable"));
    jest.spyOn(prisma.order, "delete").mockRejectedValueOnce(new Error("cleanup failed") as never);

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 2300,
        currency: "usd",
        metadata: { subtotalCents: 2300, orderId: "ord_cleanup_fail" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Stripe unavailable");
    expect(prisma.order.delete).toHaveBeenCalledWith({ where: { id: "ord_created_test" } });
  });

  it("returns 503 when no active location is available", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    jest.spyOn(prisma.location, "findFirst").mockResolvedValueOnce(null as never);

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1200,
        currency: "usd",
        metadata: { subtotalCents: 1200, orderId: "ord_no_location" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe("No active location available for checkout");
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("uses metadata.locationId when top-level locationId is absent", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_loc_meta",
      id: "cs_test_loc_meta",
    });

    const findFirstSpy = jest
      .spyOn(prisma.location, "findFirst")
      .mockResolvedValue({ id: "loc_from_meta" } as never);

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1400,
        currency: "usd",
        metadata: {
          subtotalCents: 1400,
          locationId: "loc_meta_1",
          orderId: "ord_loc_meta",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(findFirstSpy).toHaveBeenCalledWith({
      where: { id: "loc_meta_1", isActive: true },
      select: { id: true },
    });
  });

  it("prefers top-level locationId over metadata.locationId", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_loc_top",
      id: "cs_test_loc_top",
    });

    const findFirstSpy = jest
      .spyOn(prisma.location, "findFirst")
      .mockResolvedValue({ id: "loc_from_top_level" } as never);

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1400,
        currency: "usd",
        locationId: "loc_top_1",
        metadata: {
          subtotalCents: 1400,
          locationId: "loc_meta_ignored",
          orderId: "ord_loc_top",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(findFirstSpy).toHaveBeenCalledWith({
      where: { id: "loc_top_1", isActive: true },
      select: { id: true },
    });
  });

  it("uses computed subtotal and serverEstimatedTaxCents fallback when subtotal metadata is omitted", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_no_subtotal",
      id: "cs_test_no_subtotal",
    });

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 100,
        currency: "usd",
        metadata: {
          tipCents: 100,
          orderId: "ord_no_subtotal",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 0,
              product_data: expect.objectContaining({ name: "Backyard BBQ Order" }),
            }),
          }),
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 100,
              product_data: expect.objectContaining({ name: "Tip" }),
            }),
          }),
        ]),
        metadata: expect.objectContaining({
          serverEstimatedTaxCents: "0",
        }),
      }),
      undefined
    );
  });

  it("returns generic failure message when a non-Error value is thrown", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockRejectedValue("stripe exploded");

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 2200,
        currency: "usd",
        metadata: { subtotalCents: 2200, orderId: "ord_non_error_throw" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Failed to create checkout session");
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

  it("enforces checkout rate limiting using x-real-ip when forwarded header is missing", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_rl_real_ip",
      id: "cs_test_rl_real_ip",
    });

    let lastStatus = 200;
    for (let index = 0; index < 11; index += 1) {
      const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-real-ip": "203.0.113.51",
        },
        body: JSON.stringify({
          amountCents: 1200,
          currency: "usd",
          metadata: { subtotalCents: 1200, orderId: `ord_rl_real_${index}` },
        }),
      });

      const response = await POST(request);
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
  });

  it("falls back to unknown request ip when forwarded value is blank", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_rl_unknown",
      id: "cs_test_rl_unknown",
    });

    let lastStatus = 200;
    for (let index = 0; index < 11; index += 1) {
      const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "   ",
        },
        body: JSON.stringify({
          amountCents: 1250,
          currency: "usd",
          metadata: { subtotalCents: 1250, orderId: `ord_rl_unknown_${index}` },
        }),
      });

      const response = await POST(request);
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
  });

  it("uses the first forwarded ip when multiple proxies are present", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_client_secret_rl_proxy",
      id: "cs_test_rl_proxy",
    });

    let lastStatus = 200;
    for (let index = 0; index < 11; index += 1) {
      const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.77, 203.0.113.33",
          "x-real-ip": "203.0.113.200",
        },
        body: JSON.stringify({
          amountCents: 1300,
          currency: "usd",
          metadata: { subtotalCents: 1300, orderId: `ord_rl_proxy_${index}` },
        }),
      });

      const response = await POST(request);
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
  });
});
