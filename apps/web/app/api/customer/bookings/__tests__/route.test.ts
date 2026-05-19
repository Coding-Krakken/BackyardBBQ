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
        payments: [
          {
            amountCents: 10000,
            paymentType: "deposit",
          },
        ],
        location: {
          id: "loc_1",
          name: "Downtown",
          type: "restaurant",
        },
      },
    ] as never);

    jest.spyOn(prisma.cateringBooking, "count").mockResolvedValue(1);
    const paymentFindManySpy = jest.spyOn(prisma.paymentTransaction, "findMany");

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
    expect(paymentFindManySpy).not.toHaveBeenCalled();
  });

  it("computes deposit totals per booking and ignores non-deposit payments", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_1" },
    });

    const bookingsFindManySpy = jest.spyOn(prisma.cateringBooking, "findMany").mockResolvedValue([
      {
        id: "booking_1",
        customerId: "cust_1",
        eventDate: new Date("2026-08-10T12:00:00.000Z"),
        status: "approved",
        depositCents: 30000,
        payments: [
          { amountCents: 5000, paymentType: "deposit" },
          { amountCents: 7000, paymentType: "deposit" },
          { amountCents: 25000, paymentType: "order" },
        ],
        location: {
          id: "loc_1",
          name: "Downtown",
          type: "restaurant",
        },
      },
      {
        id: "booking_2",
        customerId: "cust_1",
        eventDate: new Date("2026-09-10T12:00:00.000Z"),
        status: "pending_approval",
        depositCents: 15000,
        payments: [],
        location: {
          id: "loc_2",
          name: "Uptown",
          type: "restaurant",
        },
      },
    ] as never);
    const bookingsCountSpy = jest.spyOn(prisma.cateringBooking, "count").mockResolvedValue(2);
    const paymentFindManySpy = jest.spyOn(prisma.paymentTransaction, "findMany");

    const request = new NextRequest("http://localhost/api/customer/bookings?limit=10&offset=0", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.bookings).toHaveLength(2);
    expect(payload.bookings[0]).toEqual(
      expect.objectContaining({
        id: "booking_1",
        depositPaidCents: 12000,
        depositDueCents: 18000,
      })
    );
    expect(payload.bookings[1]).toEqual(
      expect.objectContaining({
        id: "booking_2",
        depositPaidCents: 0,
        depositDueCents: 15000,
      })
    );
    expect(bookingsFindManySpy).toHaveBeenCalledTimes(1);
    expect(bookingsCountSpy).toHaveBeenCalledTimes(1);
    expect(paymentFindManySpy).not.toHaveBeenCalled();
  });

  it("returns empty bookings and skips direct paymentTransaction lookup", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_1" },
    });

    jest.spyOn(prisma.cateringBooking, "findMany").mockResolvedValue([] as never);
    jest.spyOn(prisma.cateringBooking, "count").mockResolvedValue(0);
    const paymentFindManySpy = jest.spyOn(prisma.paymentTransaction, "findMany");

    const request = new NextRequest("http://localhost/api/customer/bookings?limit=10&offset=0", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.bookings).toEqual([]);
    expect(payload.pagination).toEqual({
      total: 0,
      limit: 10,
      offset: 0,
      hasMore: false,
    });
    expect(paymentFindManySpy).not.toHaveBeenCalled();
  });

  it("handles 100 bookings within latency budget and bounded queries", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_1" },
    });

    const bookings = Array.from({ length: 100 }, (_, index) => ({
      id: `booking_${index + 1}`,
      customerId: "cust_1",
      eventDate: new Date("2026-08-10T12:00:00.000Z"),
      status: "approved",
      depositCents: 30000,
      payments: [
        {
          amountCents: 10000,
          paymentType: "deposit",
        },
      ],
      location: {
        id: "loc_1",
        name: "Downtown",
        type: "restaurant",
      },
    }));

    const bookingsFindManySpy = jest
      .spyOn(prisma.cateringBooking, "findMany")
      .mockResolvedValue(bookings as never);
    const bookingsCountSpy = jest
      .spyOn(prisma.cateringBooking, "count")
      .mockResolvedValue(100);
    const paymentFindManySpy = jest.spyOn(prisma.paymentTransaction, "findMany");

    const request = new NextRequest("http://localhost/api/customer/bookings?limit=100&offset=0", {
      method: "GET",
    });

    const startedAt = Date.now();
    const response = await GET(request);
    const elapsedMs = Date.now() - startedAt;
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.bookings).toHaveLength(100);
    expect(payload.bookings[0]).toEqual(
      expect.objectContaining({
        depositPaidCents: 10000,
        depositDueCents: 20000,
      })
    );
    expect(bookingsFindManySpy).toHaveBeenCalledTimes(1);
    expect(bookingsCountSpy).toHaveBeenCalledTimes(1);
    expect(paymentFindManySpy).not.toHaveBeenCalled();
    expect(elapsedMs).toBeLessThan(150);
  });
});
