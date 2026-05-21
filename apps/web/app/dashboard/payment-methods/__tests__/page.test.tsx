import { render, screen, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import PaymentMethodsPage from "../page";
import { getClientPaymentProvider } from "../../../lib/payment-provider";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock("../../../lib/payment-provider", () => ({
  getClientPaymentProvider: jest.fn(),
}));

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } as never;
}

describe("PaymentMethodsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (usePathname as jest.Mock).mockReturnValue("/dashboard/payment-methods");
    (useSession as jest.Mock).mockReturnValue({ status: "authenticated" });
    (getClientPaymentProvider as jest.Mock).mockReturnValue("epos");
  });

  it("shows the EPOS-only message without fetching saved cards", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/customer/notifications")) {
        return createJsonResponse({ notifications: [] });
      }

      return createJsonResponse({ paymentMethods: [], defaultPaymentMethodId: null });
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    render(<PaymentMethodsPage />);

    await waitFor(() => {
      expect(screen.getByText("Payments are processed directly through our integrated EPOS system at the point of service.")).toBeInTheDocument();
    });

    expect(screen.getByText(/Saved card management is not available with EPOS payment processing/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Billing Portal" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/customer/payment-methods"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/customer/portal-session"))).toBe(false);
  });
});