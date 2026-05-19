/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "../route";

describe("POST /api/payments/calculate-tax", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for invalid payload", async () => {
    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtotalCents: -1 }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid tax calculation payload");
  });

  it("returns 400 when request body is malformed JSON", async () => {
    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Provide either subtotalCents or items for tax calculation");
  });

  it("returns 400 when neither subtotal nor items are provided", async () => {
    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currency: "usd" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Provide either subtotalCents or items for tax calculation");
  });

  it("calculates tax from subtotal", async () => {
    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtotalCents: 2500, currency: "usd" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      subtotalCents: 2500,
      estimatedTaxCents: 200,
      totalCents: 2700,
      taxRate: 0.08,
      currency: "usd",
    });
  });

  it("calculates tax from cart items", async () => {
    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            unitPriceCents: 1000,
            quantity: 2,
            customizations: [{ priceCents: 150 }],
          },
          {
            unitPriceCents: 500,
            quantity: 1,
            customizations: [],
          },
        ],
        currency: "usd",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.subtotalCents).toBe(2800);
    expect(payload.estimatedTaxCents).toBe(224);
    expect(payload.totalCents).toBe(3024);
  });

  it("uses default currency when omitted", async () => {
    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtotalCents: 1000 }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.currency).toBe("usd");
  });

  it("uses subtotal fallback when items array is empty", async () => {
    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subtotalCents: 1500,
        items: [],
        currency: "usd",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.subtotalCents).toBe(1500);
    expect(payload.estimatedTaxCents).toBe(120);
    expect(payload.totalCents).toBe(1620);
  });

  it("calculates item subtotal when customizations are omitted", async () => {
    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            unitPriceCents: 750,
            quantity: 2,
          },
        ],
        currency: "usd",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.subtotalCents).toBe(1500);
    expect(payload.estimatedTaxCents).toBe(120);
    expect(payload.totalCents).toBe(1620);
  });

  it("returns 500 when tax computation throws unexpectedly", async () => {
    const roundSpy = jest.spyOn(Math, "round").mockImplementation(() => {
      throw new Error("math failed");
    });

    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtotalCents: 2500, currency: "usd" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Failed to calculate tax");

    roundSpy.mockRestore();
  });

  it("uses SALES_TAX_RATE from environment when provided", async () => {
    const originalSalesTaxRate = process.env.SALES_TAX_RATE;
    process.env.SALES_TAX_RATE = "0.09";

    jest.resetModules();
    const { POST: isolatedPost } = await import("../route");

    const request = new NextRequest("http://localhost/api/payments/calculate-tax", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtotalCents: 1000, currency: "usd" }),
    });

    const response = await isolatedPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.taxRate).toBe(0.09);
    expect(payload.estimatedTaxCents).toBe(90);
    expect(payload.totalCents).toBe(1090);

    if (typeof originalSalesTaxRate === "string") {
      process.env.SALES_TAX_RATE = originalSalesTaxRate;
    } else {
      delete process.env.SALES_TAX_RATE;
    }
  });
});
