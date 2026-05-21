/** @jest-environment node */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../../../lib/prisma";
import { POST } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("POST /api/payments/create-catering-deposit-session (EPOS only)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYMENT_PROVIDER;
    process.env.EPOS_NOW_BASE_URL = "https://epos.example.com";
    process.env.EPOS_NOW_AUTH_TOKEN = "epos-token";
    process.env.EPOS_NOW_TENDER_TYPE_ID = "3";

    jest.spyOn(prisma.cateringBooking, "findFirst").mockResolvedValue({
      id: "booking_1",
      eventDate: new Date("2026-01-10T12:00:00.000Z"),
      partySize: 25,
      packageName: "Smokehouse Deluxe",
      status: "approved",
      depositCents: 15000,
      estimatedTotalCents: 60000,
    } as never);

    jest.spyOn(prisma.paymentTransaction, "findFirst").mockResolvedValue(null as never);
    jest.spyOn(prisma.paymentTransaction, "create").mockResolvedValue({ id: "pay_1" } as never);
    jest.spyOn(prisma.paymentTransaction, "update").mockResolvedValue({ id: "pay_1" } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/payments/create-catering-deposit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "booking_1" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("creates an EPOS deposit session", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Valid: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Id: 901, StatusId: 1, TotalAmount: 150 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const request = new NextRequest("http://localhost/api/payments/create-catering-deposit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "booking_1" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.provider).toBe("epos");
    expect(payload.sessionId).toBe("epos_booking_booking_1");
    expect(payload.clientSecret).toBeNull();
    fetchMock.mockRestore();
  });
});
