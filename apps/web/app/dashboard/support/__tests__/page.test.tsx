import { fireEvent, render, screen } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SupportPage from "../page";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../../components/DashboardLayout", () => ({
  DashboardHeader: () => <div data-testid="dashboard-header" />,
  DashboardSidebar: () => <div data-testid="dashboard-sidebar" />,
}));

describe("SupportPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (useSession as jest.Mock).mockReturnValue({ status: "authenticated" });
  });

  it("shows EPOS payment processing guidance in the FAQ", () => {
    render(<SupportPage />);

    fireEvent.click(screen.getByRole("button", { name: /How do I save my payment information\?/i }));

    expect(screen.getByText(/Payment processing is handled directly through our EPOS terminal/i)).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-sidebar")).toBeInTheDocument();
  });
});