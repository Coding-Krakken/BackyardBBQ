/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { prisma } from "../../../../../lib/prisma";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

describe("POST /api/payments/create-checkout-session configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.EPOS_NOW_BASE_URL;
    delete process.env.EPOS_NOW_AUTH_TOKEN;
    delete process.env.EPOS_NOW_TENDER_TYPE_ID;

    jest.spyOn(prisma.location, "findFirst").mockResolvedValue({ id: "loc_test" } as never);
    jest.spyOn(prisma.order, "create").mockResolvedValue({ id: "ord_created_test" } as never);
    jest.spyOn(prisma.order, "delete").mockResolvedValue({ id: "ord_created_test" } as never);
    jest.spyOn(prisma.order, "update").mockResolvedValue({ id: "ord_created_test", status: "confirmed" } as never);
    jest.spyOn(prisma.paymentTransaction, "upsert").mockResolvedValue({ id: "pay_1" } as never);
  });

  it("returns 500 when EPOS base URL is missing", async () => {
    process.env.EPOS_NOW_AUTH_TOKEN = "epos-token";
    process.env.EPOS_NOW_TENDER_TYPE_ID = "3";

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1000,
        currency: "usd",
        metadata: { subtotalCents: 1000 },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Missing EPOS_NOW_BASE_URL");
  });

  it("returns 500 when EPOS tender type is missing", async () => {
    process.env.EPOS_NOW_BASE_URL = "https://epos.example.com";
    process.env.EPOS_NOW_AUTH_TOKEN = "epos-token";

    const request = new NextRequest("http://localhost/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountCents: 1000,
        currency: "usd",
        metadata: { subtotalCents: 1000 },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Missing EPOS_NOW_TENDER_TYPE_ID");
  });
});
