/** @jest-environment node */

import { getServerSession } from "next-auth";
import { DELETE } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

/**
 * DELETE /api/customer/payment-methods/[id]
 * Route returns 410 Gone for all EPOS provider requests because saved
 * payment methods are managed directly through the EPOS terminal—not
 * through a server-side token vault.
 */
describe("DELETE /api/customer/payment-methods/[id] — EPOS mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PAYMENT_PROVIDER = "epos";
  });

  afterEach(() => {
    delete process.env.PAYMENT_PROVIDER;
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

  it("returns 410 with EPOS unavailability message when authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_1" } });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "spm_epos_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.error).toContain("EPOS");
    expect(payload.paymentMethodId).toBe("spm_epos_1");
  });

  it("returns 410 regardless of payment method id value", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "cust_2" } });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "any-random-id" }),
    });

    expect(response.status).toBe(410);
  });
});
