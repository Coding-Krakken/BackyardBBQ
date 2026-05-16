/** @jest-environment node */

import { getServerSession } from "next-auth";
import { prisma } from "../../../../../../lib/prisma";
import { DELETE } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("DELETE /api/customer/payment-methods/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 404 when payment method is missing", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.savedPaymentMethod, "findFirst").mockResolvedValue(null as never);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_missing" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(payload.error).toBe("Payment method not found");
  });

  it("deletes default method and reassigns next default", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.savedPaymentMethod, "findFirst").mockResolvedValue({
      id: "spm_1",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_1",
      isDefault: true,
    } as never);

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_1",
      stripeCustomerId: null,
      defaultPaymentMethodId: "pm_1",
    } as never);

    const deleteMock = jest.fn().mockResolvedValue({ id: "spm_1" });
    const findNextDefaultMock = jest.fn().mockResolvedValue({
      id: "spm_2",
      stripePaymentMethodId: "pm_2",
    });
    const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
    const updateMock = jest.fn().mockResolvedValue({ id: "spm_2", isDefault: true });
    const updateCustomerMock = jest.fn().mockResolvedValue({ id: "cust_1" });

    jest.spyOn(prisma, "$transaction").mockImplementation(async (fn: any) => {
      return fn({
        savedPaymentMethod: {
          delete: deleteMock,
          findFirst: findNextDefaultMock,
          updateMany: updateManyMock,
          update: updateMock,
        },
        customer: {
          update: updateCustomerMock,
        },
      });
    });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "spm_1" } });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "spm_2" },
      data: { isDefault: true },
    });
    expect(updateCustomerMock).toHaveBeenCalledWith({
      where: { id: "cust_1" },
      data: { defaultPaymentMethodId: "pm_2" },
    });
  });
});
