/** @jest-environment node */

import { getServerSession } from "next-auth";
import { DELETE } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("DELETE /api/customer/payment-methods/[id] (EPOS only)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYMENT_PROVIDER;
  });

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "pm_1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 410 because saved methods are disabled under EPOS", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "pm_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.paymentMethodId).toBe("pm_1");
  });
});
