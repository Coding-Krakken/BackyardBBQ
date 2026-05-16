/** @jest-environment node */

import { getServerSession } from "next-auth";
import { prisma } from "../../../../../../../lib/prisma";
import { PATCH } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("PATCH /api/customer/payment-methods/[id]/set-default", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await PATCH(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 404 when payment method is not found", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.savedPaymentMethod, "findFirst").mockResolvedValue(null as never);

    const response = await PATCH(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_missing" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(payload.error).toBe("Payment method not found");
  });

  it("sets the selected method as default", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.savedPaymentMethod, "findFirst").mockResolvedValue({
      id: "spm_1",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_1",
    } as never);

    const updateManyMock = jest.fn().mockResolvedValue({ count: 2 });
    const updateMethodMock = jest.fn().mockResolvedValue({ id: "spm_1", isDefault: true });
    const updateCustomerMock = jest.fn().mockResolvedValue({ id: "cust_1" });

    jest.spyOn(prisma, "$transaction").mockImplementation(async (fn: any) => {
      return fn({
        savedPaymentMethod: {
          updateMany: updateManyMock,
          update: updateMethodMock,
        },
        customer: {
          update: updateCustomerMock,
        },
      });
    });

    const response = await PATCH(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { customerId: "cust_1" },
      data: { isDefault: false },
    });
    expect(updateMethodMock).toHaveBeenCalledWith({
      where: { id: "spm_1" },
      data: { isDefault: true },
    });
    expect(updateCustomerMock).toHaveBeenCalledWith({
      where: { id: "cust_1" },
      data: { defaultPaymentMethodId: "pm_1" },
    });
  });
});
