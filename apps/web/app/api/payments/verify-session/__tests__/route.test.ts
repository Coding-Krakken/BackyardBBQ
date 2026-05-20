/** @jest-environment node */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { prisma } from "../../../../../lib/prisma";

describe("GET /api/payments/verify-session (EPOS only)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.EPOS_NOW_BASE_URL;
    delete process.env.EPOS_NOW_AUTH_TOKEN;
    jest.spyOn(prisma.paymentTransaction, "findUnique").mockResolvedValue(null as never);
    jest.spyOn(prisma.paymentTransaction, "findFirst").mockResolvedValue(null as never);
    jest.spyOn(prisma.order, "findUnique").mockResolvedValue(null as never);
    jest.spyOn(prisma.cateringBooking, "findUnique").mockResolvedValue(null as never);
  });

  it("returns 400 when session_id is missing", async () => {
    const request = new NextRequest("http://localhost/api/payments/verify-session", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Missing session_id parameter");
  });

  it("verifies an EPOS order session", async () => {
    process.env.EPOS_NOW_BASE_URL = "https://epos.example.com";
    process.env.EPOS_NOW_AUTH_TOKEN = "epos-token";

    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: "ord_epos_1",
      currency: "usd",
      subtotalCents: 1000,
      taxCents: 80,
      totalCents: 1080,
      status: "confirmed",
    });

    (prisma.paymentTransaction.findUnique as jest.Mock).mockResolvedValue({ status: "succeeded" });

    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Id: 77, StatusId: 1, TotalAmount: 10.8 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = new NextRequest("http://localhost/api/payments/verify-session?session_id=epos_order_ord_epos_1", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        provider: "epos",
        status: "complete",
        paymentStatus: "paid",
        orderId: "ord_epos_1",
        amountTotal: 1080,
      })
    );
    fetchMock.mockRestore();
  });

  it("verifies an EPOS booking session", async () => {
    process.env.EPOS_NOW_BASE_URL = "https://epos.example.com";
    process.env.EPOS_NOW_AUTH_TOKEN = "epos-token";

    (prisma.cateringBooking.findUnique as jest.Mock).mockResolvedValue({
      id: "booking_epos_1",
      depositCents: 15000,
    });

    (prisma.paymentTransaction.findFirst as jest.Mock).mockResolvedValue({
      status: "succeeded",
      amountCents: 15000,
      currency: "usd",
    });

    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Id: 401, StatusId: 1, TotalAmount: 150 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = new NextRequest("http://localhost/api/payments/verify-session?session_id=epos_booking_booking_epos_1", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        provider: "epos",
        status: "complete",
        paymentStatus: "paid",
        bookingId: "booking_epos_1",
      })
    );
    fetchMock.mockRestore();
  });
});
