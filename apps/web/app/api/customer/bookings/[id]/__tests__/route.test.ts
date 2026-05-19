/** @jest-environment node */

import { getServerSession } from "next-auth";
import { prisma } from "../../../../../../lib/prisma";
import { GET } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("GET /api/customer/bookings/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/customer/bookings/booking_1"), {
      params: Promise.resolve({ id: "booking_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns booking detail with payments and computed deposit totals", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_1" },
    });

    const bookingFindFirstSpy = jest.spyOn(prisma.cateringBooking, "findFirst").mockResolvedValue({
      id: "booking_1",
      customerId: "cust_1",
      eventDate: new Date("2026-08-10T12:00:00.000Z"),
      status: "approved",
      depositCents: 30000,
      location: {
        id: "loc_1",
        name: "Downtown",
        type: "restaurant",
      },
      payments: [
        {
          id: "pay_1",
          amountCents: 10000,
          currency: "usd",
          status: "succeeded",
          paymentType: "deposit",
          createdAt: new Date("2026-06-10T12:00:00.000Z"),
        },
        {
          id: "pay_2",
          amountCents: 20000,
          currency: "usd",
          status: "succeeded",
          paymentType: "order",
          createdAt: new Date("2026-06-11T12:00:00.000Z"),
        },
      ],
    } as never);
    const paymentFindManySpy = jest.spyOn(prisma.paymentTransaction, "findMany");

    const response = await GET(new Request("http://localhost/api/customer/bookings/booking_1"), {
      params: Promise.resolve({ id: "booking_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.booking).toEqual(
      expect.objectContaining({
        id: "booking_1",
        depositCents: 30000,
      })
    );
    expect(payload.payments).toHaveLength(2);
    expect(payload.depositPaidCents).toBe(10000);
    expect(payload.depositDueCents).toBe(20000);
    expect(bookingFindFirstSpy).toHaveBeenCalledTimes(1);
    expect(paymentFindManySpy).not.toHaveBeenCalled();
  });
});
