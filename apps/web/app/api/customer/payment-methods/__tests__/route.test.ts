/** @jest-environment node */

import { getServerSession } from "next-auth";
import { GET } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("GET /api/customer/payment-methods (EPOS only)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYMENT_PROVIDER;
  });

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns EPOS capability response when authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.provider).toBe("epos");
    expect(payload.paymentMethods).toEqual([]);
    expect(payload.defaultPaymentMethodId).toBeNull();
    expect(payload.capability).toBe("unavailable");
  });
});
