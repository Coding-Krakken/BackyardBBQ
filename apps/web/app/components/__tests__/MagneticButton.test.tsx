import { render } from "@testing-library/react";
import { MagneticButton } from "../MagneticButton";

// Mock the hooks
jest.mock("../../hooks/useMagneticEffect", () => ({
  useMagneticEffect: jest.fn(() => ({
    ref: { current: null },
    x: 0,
    y: 0,
    isHovered: false,
  })),
  usePrefersReducedMotion: jest.fn(() => false),
  useIsDesktop: jest.fn(() => true),
}));

describe("MagneticButton", () => {
  it("should render children", () => {
    const { getByText } = render(
      <MagneticButton>
        <button>Click Me</button>
      </MagneticButton>
    );
    
    expect(getByText("Click Me")).toBeInTheDocument();
  });

  it("should apply className if provided", () => {
    const { container } = render(
      <MagneticButton className="custom-class">
        <button>Click Me</button>
      </MagneticButton>
    );
    
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("should render as specified component type", () => {
    const { container } = render(
      <MagneticButton as="a" href="/test">
        Link
      </MagneticButton>
    );
    
    expect(container.querySelector("a")).toBeInTheDocument();
    expect(container.querySelector("a")).toHaveAttribute("href", "/test");
  });

  it("should respect disabled prop", () => {
    const { container } = render(
      <MagneticButton disabled>
        <button>Disabled</button>
      </MagneticButton>
    );
    
    expect(container.querySelector("div")).toBeInTheDocument();
  });
});
