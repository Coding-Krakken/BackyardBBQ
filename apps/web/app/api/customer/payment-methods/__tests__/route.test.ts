/** @jest-environment node */

import { getServerSession } from "next-auth";
import { prisma } from "../../../../../lib/prisma";
import { GET } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("GET /api/customer/payment-methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns saved payment methods and default id", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_1" },
    });

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      defaultPaymentMethodId: "pm_default",
      savedPaymentMethods: [
        {
          id: "spm_1",
          stripePaymentMethodId: "pm_1",
          brand: "visa",
          last4: "4242",
          expMonth: 12,
          expYear: 2030,
          isDefault: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    } as never);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.defaultPaymentMethodId).toBe("pm_default");
    expect(payload.paymentMethods).toHaveLength(1);
    expect(payload.paymentMethods[0]).toEqual(
      expect.objectContaining({
        id: "spm_1",
        stripePaymentMethodId: "pm_1",
        brand: "visa",
        last4: "4242",
        isDefault: true,
      })
    );
  });

  it("returns empty defaults when customer record missing", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_2" },
    });

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue(null as never);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.paymentMethods).toEqual([]);
    expect(payload.defaultPaymentMethodId).toBeNull();
  });

  it("returns 500 when payment method query fails", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_3" },
    });

    jest.spyOn(prisma.customer, "findUnique").mockRejectedValue(new Error("db down") as never);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Failed to fetch payment methods");
  });
});
