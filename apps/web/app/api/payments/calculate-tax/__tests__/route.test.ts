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
});
