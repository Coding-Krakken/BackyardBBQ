/** @jest-environment node */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../../../lib/prisma";
import { clearRateLimitStore } from "../../../../../lib/rate-limit";
import { POST } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("POST /api/payments/create-checkout-session (EPOS only)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearRateLimitStore();
    delete process.env.PAYMENT_PROVIDER;
    process.env.EPOS_NOW_BASE_URL = "https://epos.example.com";
    process.env.EPOS_NOW_AUTH_TOKEN = "epos-token";
    process.env.EPOS_NOW_TENDER_TYPE_ID = "3";

    jest.spyOn(prisma.location, "findFirst").mockResolvedValue({ id: "loc_test" } as never);
    jest.spyOn(prisma.order, "create").mockResolvedValue({ id: "ord_created_test" } as never);
    jest.spyOn(prisma.order, "delete").mockResolvedValue({ id: "ord_created_test" } as never);
    jest.spyOn(prisma.order, "update").mockResolvedValue({ id: "ord_created_test", status: "confirmed" } as never);
    jest.spyOn(prisma.paymentTransaction, "upsert").mockResolvedValue({ id: "pay_1" } as never);
    (getServerSession as jest.Mock).mockResolvedValue(null);
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
  });

  it("creates an EPOS checkout and returns an EPOS session id", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Valid: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Id: 77, StatusId: 1, TotalAmount: 10.0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1000,
        currency: "usd",
        metadata: { subtotalCents: 1000, orderId: "ord_epos_gate" },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.provider).toBe("epos");
    expect(payload.sessionId).toBe("epos_order_ord_created_test");
    expect(payload.transactionId).toBe("77");
    expect(prisma.paymentTransaction.upsert).toHaveBeenCalled();
    fetchMock.mockRestore();
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
  });
});
