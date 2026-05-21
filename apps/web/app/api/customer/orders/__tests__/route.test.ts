/** @jest-environment node */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../../../lib/prisma";
import { GET } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("GET /api/customer/orders guest tracking (EPOS only)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYMENT_PROVIDER;
    jest.spyOn(prisma.order, "findUnique").mockResolvedValue(null as never);
    jest.spyOn(prisma.order, "findMany").mockResolvedValue([] as never);
    jest.spyOn(prisma.order, "count").mockResolvedValue(0 as never);
  });

  it("returns 401 for guests without session_id", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/customer/orders", { method: "GET" });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns empty result for non-EPOS session ids", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/customer/orders?session_id=cs_test_1", {
      method: "GET",
      headers: { "x-forwarded-for": "198.51.100.5" },
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.orders).toEqual([]);
  });
});
