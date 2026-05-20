import { render, screen } from "@testing-library/react";
import { OrderingHubSection } from "../HomeSections";

jest.mock("../../lib/payment-provider", () => ({
  getClientPaymentProvider: jest.fn(() => "epos"),
}));

jest.mock("../EmberParticles", () => ({
  EmberParticles: () => null,
}));

jest.mock("framer-motion", () => {
  const React = require("react");

  const createMockComponent = (tag: keyof JSX.IntrinsicElements) => {
    return React.forwardRef(({ children, initial, animate, variants, transition, whileHover, whileTap, ...props }: any, ref: any) =>
      React.createElement(tag, { ref, ...props }, children)
    );
  };

  return {
    motion: {
      section: createMockComponent("section"),
      div: createMockComponent("div"),
      article: createMockComponent("article"),
      a: createMockComponent("a"),
    },
    useInView: jest.fn(() => true),
    useScroll: jest.fn(() => ({ scrollYProgress: { get: () => 0 } })),
    useTransform: jest.fn(() => 0),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe("OrderingHubSection", () => {
  it("shows EPOS checkout copy when EPOS payment processing is enabled", () => {
    render(<OrderingHubSection />);

    expect(screen.getByText("Secure Checkout")).toBeInTheDocument();
    expect(screen.getByText("EPOS-powered payment flow")).toBeInTheDocument();
  });
});