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

  it("deletes non-default method without reassigning defaults", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.savedPaymentMethod, "findFirst").mockResolvedValue({
      id: "spm_non_default",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_non_default",
      isDefault: false,
    } as never);

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_1",
      stripeCustomerId: null,
      defaultPaymentMethodId: "pm_other",
    } as never);

    const deleteMock = jest.fn().mockResolvedValue({ id: "spm_non_default" });
    const findNextDefaultMock = jest.fn();
    const updateManyMock = jest.fn();
    const updateMock = jest.fn();
    const updateCustomerMock = jest.fn();

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
      params: Promise.resolve({ id: "spm_non_default" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "spm_non_default" } });
    expect(findNextDefaultMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(updateCustomerMock).not.toHaveBeenCalled();
  });

  it("deletes non-default method when customer profile lookup returns null", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.savedPaymentMethod, "findFirst").mockResolvedValue({
      id: "spm_non_default_no_customer",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_non_default_no_customer",
      isDefault: false,
    } as never);

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue(null as never);

    const deleteMock = jest.fn().mockResolvedValue({ id: "spm_non_default_no_customer" });
    const findNextDefaultMock = jest.fn();
    const updateManyMock = jest.fn();
    const updateMock = jest.fn();
    const updateCustomerMock = jest.fn();

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
      params: Promise.resolve({ id: "spm_non_default_no_customer" }),
    });

    expect(response.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "spm_non_default_no_customer" } });
    expect(findNextDefaultMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(updateCustomerMock).not.toHaveBeenCalled();
  });

  it("reassigns defaults when customer default matches even if method is not flagged default", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.savedPaymentMethod, "findFirst").mockResolvedValue({
      id: "spm_customer_default",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_customer_default",
      isDefault: false,
    } as never);

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_1",
      stripeCustomerId: null,
      defaultPaymentMethodId: "pm_customer_default",
    } as never);

    const deleteMock = jest.fn().mockResolvedValue({ id: "spm_customer_default" });
    const findNextDefaultMock = jest.fn().mockResolvedValue({
      id: "spm_next",
      stripePaymentMethodId: "pm_next",
    });
    const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
    const updateMock = jest.fn().mockResolvedValue({ id: "spm_next", isDefault: true });
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
      params: Promise.resolve({ id: "spm_customer_default" }),
    });

    expect(response.status).toBe(200);
    expect(findNextDefaultMock).toHaveBeenCalledTimes(1);
    expect(updateCustomerMock).toHaveBeenCalledWith({
      where: { id: "cust_1" },
      data: { defaultPaymentMethodId: "pm_next" },
    });
  });

  it("clears customer default when deleting default with no replacement", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.savedPaymentMethod, "findFirst").mockResolvedValue({
      id: "spm_default",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_default",
      isDefault: true,
    } as never);

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_1",
      stripeCustomerId: null,
      defaultPaymentMethodId: "pm_default",
    } as never);

    const deleteMock = jest.fn().mockResolvedValue({ id: "spm_default" });
    const findNextDefaultMock = jest.fn().mockResolvedValue(null);
    const updateManyMock = jest.fn().mockResolvedValue({ count: 0 });
    const updateMock = jest.fn();
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
      params: Promise.resolve({ id: "spm_default" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(updateMock).not.toHaveBeenCalled();
    expect(updateCustomerMock).toHaveBeenCalledWith({
      where: { id: "cust_1" },
      data: { defaultPaymentMethodId: null },
    });
  });

  it("returns 500 when transactional delete fails", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    jest.spyOn(prisma.savedPaymentMethod, "findFirst").mockResolvedValue({
      id: "spm_1",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_1",
      isDefault: false,
    } as never);

    jest.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      id: "cust_1",
      stripeCustomerId: null,
      defaultPaymentMethodId: "pm_other",
    } as never);

    jest
      .spyOn(prisma, "$transaction")
      .mockRejectedValue(new Error("Database unavailable") as never);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });

    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.error).toBe("Failed to remove payment method");
  });
});
