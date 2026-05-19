/** @jest-environment node */

import { NextRequest } from "next/server";

describe("POST /api/payments/create-checkout-session init branches", () => {
  const originalSalesTaxRate = process.env.SALES_TAX_RATE;
  const originalStripeSecret = process.env.STRIPE_SECRET_KEY;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "test_checkout_secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  afterAll(() => {
    if (typeof originalSalesTaxRate === "string") {
      process.env.SALES_TAX_RATE = originalSalesTaxRate;
    } else {
      delete process.env.SALES_TAX_RATE;
    }

    if (typeof originalStripeSecret === "string") {
      process.env.STRIPE_SECRET_KEY = originalStripeSecret;
    } else {
      delete process.env.STRIPE_SECRET_KEY;
    }

    if (typeof originalSiteUrl === "string") {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  });

  async function setupRouteAndRun(options: {
    salesTaxRate?: string;
    forwardedFor?: string;
    realIp?: string;
  }) {
    if (typeof options.salesTaxRate === "string") {
      process.env.SALES_TAX_RATE = options.salesTaxRate;
    } else {
      delete process.env.SALES_TAX_RATE;
    }

    const checkoutCreateMock = jest.fn().mockResolvedValue({
      client_secret: "seti_init",
      id: "cs_init",
    });
    const checkRateLimitMock = jest.fn().mockReturnValue({ allowed: true });

    jest.doMock("stripe", () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        checkout: { sessions: { create: checkoutCreateMock } },
        customers: { create: jest.fn() },
      })),
    }));
    jest.doMock("next-auth", () => ({
      getServerSession: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock("../../../../../lib/rate-limit", () => ({
      checkRateLimit: checkRateLimitMock,
    }));
    jest.doMock("../../../../../lib/prisma", () => ({
      prisma: {
        location: { findFirst: jest.fn().mockResolvedValue({ id: "loc_test" }) },
        order: {
          create: jest.fn().mockResolvedValue({ id: "ord_created" }),
          delete: jest.fn().mockResolvedValue({ id: "ord_created" }),
        },
        customer: { findUnique: jest.fn().mockResolvedValue(null) },
      },
    }));

    const { POST } = await import("../route");

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (typeof options.forwardedFor === "string") {
      headers["x-forwarded-for"] = options.forwardedFor;
    }
    if (typeof options.realIp === "string") {
      headers["x-real-ip"] = options.realIp;
    }

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers,
      body: JSON.stringify({
        amountCents: 1000,
        currency: "usd",
        metadata: { subtotalCents: 1000, orderId: "ord_init_test" },
      }),
    });

    const response = await POST(request);
    return { response, checkoutCreateMock, checkRateLimitMock };
  }

  it("uses default tax rate when SALES_TAX_RATE is unset", async () => {
    const { response, checkoutCreateMock } = await setupRouteAndRun({
      forwardedFor: "198.51.100.20",
    });

    expect(response.status).toBe(200);
    expect(checkoutCreateMock).toHaveBeenCalledWith(
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
  });

  it("uses configured SALES_TAX_RATE during module initialization", async () => {
    const { response, checkoutCreateMock } = await setupRouteAndRun({
      salesTaxRate: "0.09",
      forwardedFor: "198.51.100.21",
    });

    expect(response.status).toBe(200);
    expect(checkoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 90,
            }),
          }),
        ]),
      }),
      undefined
    );
  });

  it("falls back to x-real-ip when forwarded first token is blank", async () => {
    const { response, checkRateLimitMock } = await setupRouteAndRun({
      forwardedFor: "   , 203.0.113.50",
      realIp: "203.0.113.99",
    });

    expect(response.status).toBe(200);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: "checkout:203.0.113.99" })
    );
  });

  it("falls back to x-real-ip when forwarded split first token is undefined", async () => {
    delete process.env.SALES_TAX_RATE;

    const checkoutCreateMock = jest.fn().mockResolvedValue({
      client_secret: "seti_init_weird",
      id: "cs_init_weird",
    });
    const checkRateLimitMock = jest.fn().mockReturnValue({ allowed: true });

    jest.doMock("stripe", () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        checkout: { sessions: { create: checkoutCreateMock } },
        customers: { create: jest.fn() },
      })),
    }));
    jest.doMock("next-auth", () => ({
      getServerSession: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock("../../../../../lib/rate-limit", () => ({
      checkRateLimit: checkRateLimitMock,
    }));
    jest.doMock("../../../../../lib/prisma", () => ({
      prisma: {
        location: { findFirst: jest.fn().mockResolvedValue({ id: "loc_test" }) },
        order: {
          create: jest.fn().mockResolvedValue({ id: "ord_created" }),
          delete: jest.fn().mockResolvedValue({ id: "ord_created" }),
        },
        customer: { findUnique: jest.fn().mockResolvedValue(null) },
      },
    }));

    const { POST } = await import("../route");

    const fakeRequest = {
      headers: {
        get: (name: string) => {
          if (name === "x-forwarded-for") {
            return {
              split: () => [undefined],
            };
          }

          if (name === "x-real-ip") {
            return "203.0.113.77";
          }

          return null;
        },
      },
      json: async () => ({
        amountCents: 1000,
        currency: "usd",
        metadata: { subtotalCents: 1000, orderId: "ord_init_weird" },
      }),
    } as unknown as NextRequest;

    const response = await POST(fakeRequest);

    expect(response.status).toBe(200);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: "checkout:203.0.113.77" })
    );
  });
});
