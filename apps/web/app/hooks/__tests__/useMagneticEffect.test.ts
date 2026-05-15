import { renderHook } from "@testing-library/react";
import { useMagneticEffect, usePrefersReducedMotion, useIsDesktop } from "../useMagneticEffect";

describe("useMagneticEffect", () => {
  it("should initialize with default values", () => {
    const { result } = renderHook(() => useMagneticEffect());
    
    expect(result.current.ref).toBeDefined();
    expect(result.current.x).toBeDefined();
    expect(result.current.y).toBeDefined();
    expect(result.current.isHovered).toBe(false);
  });

  it("should respect disabled option", () => {
    const { result } = renderHook(() => useMagneticEffect({ disabled: true }));
    
    expect(result.current.ref).toBeDefined();
  });

  it("should use custom strength value", () => {
    const { result } = renderHook(() => useMagneticEffect({ strength: 0.5 }));
    
    expect(result.current.ref).toBeDefined();
  });
});

describe("usePrefersReducedMotion", () => {
  beforeEach(() => {
    // Mock matchMedia
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  it("should return false when reduced motion is not preferred", () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    
    expect(result.current).toBe(false);
  });

  it("should return true when reduced motion is preferred", () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { result } = renderHook(() => usePrefersReducedMotion());
    
    expect(result.current).toBe(true);
  });
});

describe("useIsDesktop", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  it("should return false on mobile", () => {
    const { result } = renderHook(() => useIsDesktop());
    
    expect(result.current).toBe(false);
  });

  it("should return true on desktop with hover support", () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === "(min-width: 1024px) and (hover: hover)",
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { result } = renderHook(() => useIsDesktop());
    
    expect(result.current).toBe(true);
  });
});
