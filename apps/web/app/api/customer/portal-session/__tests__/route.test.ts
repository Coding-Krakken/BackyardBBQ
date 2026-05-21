/** @jest-environment node */

import { getServerSession } from "next-auth";
import { POST } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("POST /api/customer/portal-session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYMENT_PROVIDER;
  });

  it("returns 501 when PAYMENT_PROVIDER is epos and user is authenticated", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "cust_1", email: "guest@example.com" },
    });

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(501);
    expect(payload.error).toContain("EPOS");
    expect((getServerSession as jest.Mock).mock.calls.length).toBe(1);
  });

  it("returns 401 when unauthenticated", async () => {
    process.env.PAYMENT_PROVIDER = "epos";
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 401 before provider evaluation when unauthenticated", async () => {
    delete process.env.PAYMENT_PROVIDER;
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });
});
