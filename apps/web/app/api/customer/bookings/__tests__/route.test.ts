/** @jest-environment node */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../../../lib/prisma";
import { GET } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("GET /api/customer/bookings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/customer/bookings", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns bookings with computed deposit due", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_1" },
    });

    const bookingDate = new Date("2026-08-10T12:00:00.000Z");

    jest.spyOn(prisma.cateringBooking, "findMany").mockResolvedValue([
      {
        id: "booking_1",
        customerId: "cust_1",
        eventDate: bookingDate,
        status: "approved",
        depositCents: 30000,
        location: {
          id: "loc_1",
          name: "Downtown",
          type: "restaurant",
        },
      },
    ] as never);

    jest.spyOn(prisma.cateringBooking, "count").mockResolvedValue(1);

    jest.spyOn(prisma.paymentTransaction, "findMany").mockResolvedValue([
      {
        bookingId: "booking_1",
        amountCents: 10000,
        paymentType: "deposit",
      },
    ] as never);

    const request = new NextRequest("http://localhost/api/customer/bookings?upcoming=true&limit=10&offset=0", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.pagination).toEqual({
      total: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    });
    expect(payload.bookings).toHaveLength(1);
    expect(payload.bookings[0]).toEqual(
      expect.objectContaining({
        id: "booking_1",
        depositPaidCents: 10000,
        depositDueCents: 20000,
      })
    );
  });
});
