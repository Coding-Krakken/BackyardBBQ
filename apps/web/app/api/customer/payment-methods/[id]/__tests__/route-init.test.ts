/** @jest-environment node */

describe("DELETE /api/customer/payment-methods/[id] module init branches", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("initializes Stripe and detaches when key is present", async () => {
    process.env.STRIPE_SECRET_KEY = "test_present_secret";

    const detachMock = jest.fn().mockResolvedValue({ id: "pm_1" });
    const stripeCtor = jest.fn().mockImplementation(() => ({
      paymentMethods: {
        detach: detachMock,
      },
    }));

    const transactionMock = jest.fn().mockImplementation(async (fn: any) =>
      fn({
        savedPaymentMethod: {
          delete: jest.fn().mockResolvedValue({ id: "spm_1" }),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
        },
        customer: {
          update: jest.fn(),
        },
      })
    );

    jest.doMock("stripe", () => ({
      __esModule: true,
      default: stripeCtor,
    }));
    jest.doMock("next-auth", () => ({
      getServerSession: jest.fn().mockResolvedValue({ user: { id: "cust_1" } }),
    }));
    jest.doMock("../../../../../../lib/prisma", () => ({
      prisma: {
        savedPaymentMethod: {
          findFirst: jest.fn().mockResolvedValue({
            id: "spm_1",
            customerId: "cust_1",
            stripePaymentMethodId: "pm_1",
            isDefault: false,
          }),
        },
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: "cust_1",
            stripeCustomerId: "cus_1",
            defaultPaymentMethodId: "pm_other",
          }),
        },
        $transaction: transactionMock,
      },
    }));

    const { DELETE } = await import("../route");
    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });

    expect(response.status).toBe(200);
    expect(stripeCtor).toHaveBeenCalledTimes(1);
    expect(detachMock).toHaveBeenCalledWith("pm_1");
  });

  it("does not initialize Stripe when key is blank", async () => {
    process.env.STRIPE_SECRET_KEY = "   ";

    const detachMock = jest.fn();
    const stripeCtor = jest.fn().mockImplementation(() => ({
      paymentMethods: {
        detach: detachMock,
      },
    }));

    const transactionMock = jest.fn().mockImplementation(async (fn: any) =>
      fn({
        savedPaymentMethod: {
          delete: jest.fn().mockResolvedValue({ id: "spm_1" }),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
        },
        customer: {
          update: jest.fn(),
        },
      })
    );

    jest.doMock("stripe", () => ({
      __esModule: true,
      default: stripeCtor,
    }));
    jest.doMock("next-auth", () => ({
      getServerSession: jest.fn().mockResolvedValue({ user: { id: "cust_1" } }),
    }));
    jest.doMock("../../../../../../lib/prisma", () => ({
      prisma: {
        savedPaymentMethod: {
          findFirst: jest.fn().mockResolvedValue({
            id: "spm_1",
            customerId: "cust_1",
            stripePaymentMethodId: "pm_1",
            isDefault: false,
          }),
        },
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: "cust_1",
            stripeCustomerId: "cus_1",
            defaultPaymentMethodId: "pm_other",
          }),
        },
        $transaction: transactionMock,
      },
    }));

    const { DELETE } = await import("../route");
    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });

    expect(response.status).toBe(200);
    expect(stripeCtor).not.toHaveBeenCalled();
    expect(detachMock).not.toHaveBeenCalled();
  });

  it("does not initialize Stripe when key is undefined at request time", async () => {
    process.env.STRIPE_SECRET_KEY = "test_temp_secret";

    const detachMock = jest.fn();
    const stripeCtor = jest.fn().mockImplementation(() => ({
      paymentMethods: {
        detach: detachMock,
      },
    }));

    const transactionMock = jest.fn().mockImplementation(async (fn: any) =>
      fn({
        savedPaymentMethod: {
          delete: jest.fn().mockResolvedValue({ id: "spm_1" }),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
        },
        customer: {
          update: jest.fn(),
        },
      })
    );

    jest.doMock("stripe", () => ({
      __esModule: true,
      default: stripeCtor,
    }));
    jest.doMock("next-auth", () => ({
      getServerSession: jest.fn().mockResolvedValue({ user: { id: "cust_1" } }),
    }));
    jest.doMock("../../../../../../lib/prisma", () => ({
      prisma: {
        savedPaymentMethod: {
          findFirst: jest.fn().mockResolvedValue({
            id: "spm_1",
            customerId: "cust_1",
            stripePaymentMethodId: "pm_1",
            isDefault: false,
          }),
        },
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: "cust_1",
            stripeCustomerId: "cus_1",
            defaultPaymentMethodId: "pm_other",
          }),
        },
        $transaction: transactionMock,
      },
    }));

    const { DELETE } = await import("../route");

    delete process.env.STRIPE_SECRET_KEY;

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_1" }),
    });

    expect(response.status).toBe(200);
    expect(stripeCtor).not.toHaveBeenCalled();
    expect(detachMock).not.toHaveBeenCalled();
  });

});
