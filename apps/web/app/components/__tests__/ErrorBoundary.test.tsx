import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

describe("ErrorBoundary", () => {
  it("should render children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("should render fallback UI when child throws error", () => {
    const ThrowError = () => {
      throw new Error("Test error");
    };

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/We're having trouble loading this component/)).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it("should render custom fallback when provided", () => {
    const ThrowError = () => {
      throw new Error("Test error");
    };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    render(
      <ErrorBoundary fallback={<div>Custom Fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom Fallback")).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it("should call onError callback when error occurs", () => {
    const onError = jest.fn();
    const ThrowError = () => {
      throw new Error("Test error");
    };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});
