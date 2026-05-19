/** @jest-environment node */

describe("DELETE /api/customer/payment-methods/[id] Stripe detach paths", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "test_detach_secret";
  });

  it("returns 502 when Stripe detach fails", async () => {
    const detachMock = jest.fn().mockRejectedValue(new Error("detach failed"));
    const getServerSession = jest.fn().mockResolvedValue({ user: { id: "cust_1" } });
    const findFirst = jest.fn().mockResolvedValue({
      id: "spm_1",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_1",
      isDefault: false,
    });
    const findUnique = jest.fn().mockResolvedValue({
      id: "cust_1",
      stripeCustomerId: "cus_1",
      defaultPaymentMethodId: "pm_other",
    });

    jest.doMock("next-auth", () => ({ getServerSession }));
    jest.doMock("stripe", () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        paymentMethods: {
          detach: detachMock,
        },
      })),
    }));
    jest.doMock("../../../../../../lib/prisma", () => ({
      prisma: {
        savedPaymentMethod: { findFirst },
        customer: { findUnique },
        $transaction: jest.fn(),
      },
    }));

    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toBe("detach failed");
    expect(detachMock).toHaveBeenCalledWith("pm_1");
  });

  it("returns generic detach failure message when thrown value is not an Error", async () => {
    const detachMock = jest.fn().mockRejectedValue("detach exploded");
    const getServerSession = jest.fn().mockResolvedValue({ user: { id: "cust_1" } });
    const findFirst = jest.fn().mockResolvedValue({
      id: "spm_1",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_1",
      isDefault: false,
    });
    const findUnique = jest.fn().mockResolvedValue({
      id: "cust_1",
      stripeCustomerId: "cus_1",
      defaultPaymentMethodId: "pm_other",
    });

    jest.doMock("next-auth", () => ({ getServerSession }));
    jest.doMock("stripe", () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        paymentMethods: {
          detach: detachMock,
        },
      })),
    }));
    jest.doMock("../../../../../../lib/prisma", () => ({
      prisma: {
        savedPaymentMethod: { findFirst },
        customer: { findUnique },
        $transaction: jest.fn(),
      },
    }));

    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Stripe detach failed");
  });

  it("continues deletion flow when Stripe detach succeeds", async () => {
    const detachMock = jest.fn().mockResolvedValue({ id: "pm_1" });
    const getServerSession = jest.fn().mockResolvedValue({ user: { id: "cust_1" } });
    const findFirst = jest.fn().mockResolvedValue({
      id: "spm_1",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_1",
      isDefault: false,
    });
    const findUnique = jest.fn().mockResolvedValue({
      id: "cust_1",
      stripeCustomerId: "cus_1",
      defaultPaymentMethodId: "pm_other",
    });

    const deleteMock = jest.fn().mockResolvedValue({ id: "spm_1" });
    const transactionMock = jest.fn().mockImplementation(async (fn: any) =>
      fn({
        savedPaymentMethod: {
          delete: deleteMock,
          findFirst: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
        },
        customer: {
          update: jest.fn(),
        },
      })
    );

    jest.doMock("next-auth", () => ({ getServerSession }));
    jest.doMock("stripe", () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        paymentMethods: {
          detach: detachMock,
        },
      })),
    }));
    jest.doMock("../../../../../../lib/prisma", () => ({
      prisma: {
        savedPaymentMethod: { findFirst },
        customer: { findUnique },
        $transaction: transactionMock,
      },
    }));

    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(detachMock).toHaveBeenCalledWith("pm_1");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "spm_1" } });
    expect(transactionMock).toHaveBeenCalled();
  });

  it("skips detach when STRIPE_SECRET_KEY is missing at module load", async () => {
    process.env.STRIPE_SECRET_KEY = "   ";

    const getServerSession = jest.fn().mockResolvedValue({ user: { id: "cust_1" } });
    const findFirst = jest.fn().mockResolvedValue({
      id: "spm_1",
      customerId: "cust_1",
      stripePaymentMethodId: "pm_1",
      isDefault: false,
    });
    const findUnique = jest.fn().mockResolvedValue({
      id: "cust_1",
      stripeCustomerId: "cus_1",
      defaultPaymentMethodId: "pm_other",
    });

    const detachMock = jest.fn();
    const deleteMock = jest.fn().mockResolvedValue({ id: "spm_1" });
    const transactionMock = jest.fn().mockImplementation(async (fn: any) =>
      fn({
        savedPaymentMethod: {
          delete: deleteMock,
          findFirst: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
        },
        customer: {
          update: jest.fn(),
        },
      })
    );

    jest.doMock("next-auth", () => ({ getServerSession }));
    jest.doMock("stripe", () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        paymentMethods: {
          detach: detachMock,
        },
      })),
    }));
    jest.doMock("../../../../../../lib/prisma", () => ({
      prisma: {
        savedPaymentMethod: { findFirst },
        customer: { findUnique },
        $transaction: transactionMock,
      },
    }));

    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });

    expect(response.status).toBe(200);
    expect(detachMock).not.toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "spm_1" } });
  });

});
