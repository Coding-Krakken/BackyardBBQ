/** @jest-environment node */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { GET } from "../route";
import { prisma } from "../../../../../lib/prisma";
import { TEST_STRIPE_SECRET_KEY } from "../../../payments/__tests__/test-constants";
import { clearRateLimitStore } from "../../../../../lib/rate-limit";

var mockCheckoutSessionsRetrieve: jest.Mock;

jest.mock("stripe", () => {
  mockCheckoutSessionsRetrieve = jest.fn();

  const StripeMock = jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        retrieve: mockCheckoutSessionsRetrieve,
      },
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

describe("GET /api/customer/orders", () => {
  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = TEST_STRIPE_SECRET_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearRateLimitStore();
    jest.spyOn(prisma.paymentTransaction, "findUnique").mockResolvedValue(null as never);
  });

  it("returns 401 for unauthenticated requests without session_id", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/customer/orders", { method: "GET" });
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns guest order when session_id resolves orderId from checkout metadata", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      metadata: { orderId: "ord_guest_1" },
      payment_intent: "pi_guest_1",
    });

    jest.spyOn(prisma.order, "findUnique").mockResolvedValue({
      id: "ord_guest_1",
      status: "pending",
      source: "direct",
      subtotalCents: 1000,
      taxCents: 80,
      tipCents: 150,
      totalCents: 1230,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
      location: { id: "loc_1", name: "Downtown", type: "truck" },
      payment: { status: "succeeded", amountCents: 1230 },
    } as never);

    const request = new NextRequest("http://localhost/api/customer/orders?session_id=cs_guest_1", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.guestTracking).toBe(true);
    expect(payload.orders).toHaveLength(1);
    expect(payload.orders[0].id).toBe("ord_guest_1");
    expect(prisma.paymentTransaction.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to payment transaction lookup for guest order resolution", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      metadata: {},
      payment_intent: "pi_lookup_1",
    });

    jest.spyOn(prisma.paymentTransaction, "findUnique").mockResolvedValue({ orderId: "ord_lookup_1" } as never);
    jest.spyOn(prisma.order, "findUnique").mockResolvedValue({
      id: "ord_lookup_1",
      status: "completed",
      source: "direct",
      subtotalCents: 2000,
      taxCents: 160,
      tipCents: 0,
      totalCents: 2160,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
      location: { id: "loc_1", name: "Downtown", type: "truck" },
      payment: { status: "succeeded", amountCents: 2160 },
    } as never);

    const request = new NextRequest("http://localhost/api/customer/orders?session_id=cs_lookup_1", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.orders[0].id).toBe("ord_lookup_1");
    expect(prisma.paymentTransaction.findUnique).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: "pi_lookup_1" },
      select: { orderId: true },
    });
  });

  it("returns authenticated customer orders", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.order, "findMany").mockResolvedValue([
      {
        id: "ord_auth_1",
        status: "pending",
        source: "direct",
        subtotalCents: 1000,
        taxCents: 80,
        tipCents: 100,
        totalCents: 1180,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
        location: { id: "loc_1", name: "Downtown", type: "truck" },
        payment: { status: "processing", amountCents: 1180 },
      },
    ] as never);
    jest.spyOn(prisma.order, "count").mockResolvedValue(1);

    const request = new NextRequest("http://localhost/api/customer/orders?status=pending&limit=10&offset=0", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.orders).toHaveLength(1);
    expect(payload.pagination.total).toBe(1);
    expect(prisma.order.findMany).toHaveBeenCalled();
  });

  it("returns empty guest result when checkout session is not paid/complete", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      status: "open",
      payment_status: "unpaid",
      metadata: { orderId: "ord_guest_2" },
      payment_intent: "pi_guest_2",
    });

    const request = new NextRequest("http://localhost/api/customer/orders?session_id=cs_guest_unpaid", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.orders).toEqual([]);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("returns empty guest result when checkout source is not web-checkout", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      metadata: { orderId: "ord_guest_3", source: "other" },
      payment_intent: "pi_guest_3",
    });

    const request = new NextRequest("http://localhost/api/customer/orders?session_id=cs_guest_source", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.orders).toEqual([]);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("rate limits repeated guest tracking requests from same IP", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      metadata: { orderId: "ord_guest_rl" },
      payment_intent: "pi_guest_rl",
    });

    jest.spyOn(prisma.order, "findUnique").mockResolvedValue({
      id: "ord_guest_rl",
      status: "pending",
      source: "direct",
      subtotalCents: 1000,
      taxCents: 80,
      tipCents: 0,
      totalCents: 1080,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
      location: { id: "loc_1", name: "Downtown", type: "truck" },
      payment: { status: "succeeded", amountCents: 1080 },
    } as never);

    let lastStatus = 200;
    for (let index = 0; index < 31; index += 1) {
      const request = new NextRequest("http://localhost/api/customer/orders?session_id=cs_guest_rl", {
        method: "GET",
        headers: { "x-forwarded-for": "203.0.113.10" },
      });

      const response = await GET(request);
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
  });
});
