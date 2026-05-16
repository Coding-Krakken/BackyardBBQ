/** @jest-environment node */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../../../lib/prisma";
import { POST } from "../route";

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

describe("POST /api/payments/create-catering-deposit-session", () => {
  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/payments/create-catering-deposit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "booking_1" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid payload", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    const request = new NextRequest("http://localhost/api/payments/create-catering-deposit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid payload");
  });

  it("returns 404 when booking is not found", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.cateringBooking, "findFirst").mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/payments/create-catering-deposit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "booking_missing" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Booking not found");
  });

  it("returns 400 for unsupported booking status", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.cateringBooking, "findFirst").mockResolvedValue({
      id: "booking_1",
      eventDate: new Date("2026-09-01T12:00:00.000Z"),
      partySize: 30,
      packageName: "Family Feast",
      status: "completed",
      depositCents: 12000,
      estimatedTotalCents: 40000,
    } as never);

    const request = new NextRequest("http://localhost/api/payments/create-catering-deposit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "booking_1" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Deposit payment is unavailable for this booking status");
  });

  it("returns 400 when deposit amount is not configured", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.cateringBooking, "findFirst").mockResolvedValue({
      id: "booking_1",
      eventDate: new Date("2026-09-01T12:00:00.000Z"),
      partySize: 30,
      packageName: "Family Feast",
      status: "approved",
      depositCents: 0,
      estimatedTotalCents: 40000,
    } as never);

    const request = new NextRequest("http://localhost/api/payments/create-catering-deposit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "booking_1" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Deposit amount is not configured");
  });

  it("creates a checkout session with existing stripe customer", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    const bookingDate = new Date("2026-10-10T15:00:00.000Z");

    jest.spyOn(prisma.cateringBooking, "findFirst").mockResolvedValue({
      id: "booking_abc12345",
      eventDate: bookingDate,
      partySize: 42,
      packageName: "Pitmaster Deluxe",
      status: "approved",
      depositCents: 18000,
      estimatedTotalCents: 60000,
    } as never);

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_1",
      email: "pitmaster@example.com",
      firstName: "Pit",
      lastName: "Master",
      stripeCustomerId: "cus_existing",
    } as never);

    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_deposit_123",
      id: "cs_deposit_123",
    });

    const request = new NextRequest("http://localhost/api/payments/create-catering-deposit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "booking_abc12345" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      clientSecret: "seti_deposit_123",
      sessionId: "cs_deposit_123",
      amountCents: 18000,
    });

    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        automatic_tax: { enabled: true },
        metadata: expect.objectContaining({
          source: "catering-deposit",
          bookingId: "booking_abc12345",
          paymentType: "deposit",
          estimatedTotalCents: "60000",
          eventDate: bookingDate.toISOString(),
        }),
      })
    );
  });

  it("creates stripe customer when missing and persists stripeCustomerId", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_2" } });

    jest.spyOn(prisma.cateringBooking, "findFirst").mockResolvedValue({
      id: "booking_new_1",
      eventDate: new Date("2026-11-01T14:00:00.000Z"),
      partySize: 18,
      packageName: "Smoked Sampler",
      status: "pending_approval",
      depositCents: 9000,
      estimatedTotalCents: 30000,
    } as never);

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_2",
      email: "smoke@example.com",
      firstName: "Smoke",
      lastName: "Ring",
      stripeCustomerId: null,
    } as never);

    const updateSpy = jest
      .spyOn(prisma.customer, "update")
      .mockResolvedValue({ id: "cust_2", stripeCustomerId: "cus_new_2" } as never);

    mockCustomersCreate.mockResolvedValue({ id: "cus_new_2" });
    mockCheckoutSessionsCreate.mockResolvedValue({
      client_secret: "seti_deposit_456",
      id: "cs_deposit_456",
    });

    const request = new NextRequest("http://localhost/api/payments/create-catering-deposit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "booking_new_1" }),
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
      data: { stripeCustomerId: "cus_new_2" },
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new_2",
      })
    );
  });
});
