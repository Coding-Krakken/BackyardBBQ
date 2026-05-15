"use client";

import { useRef, useEffect, useState } from "react";
import { useMotionValue, useSpring, useTransform } from "framer-motion";

interface MagneticEffectOptions {
  strength?: number; // 0-1, how much the element moves toward cursor
  damping?: number; // Spring damping
  stiffness?: number; // Spring stiffness
  disabled?: boolean; // Disable effect (e.g., for reduced motion)
}

/**
 * Custom hook for magnetic cursor effect
 * Elements subtly move toward cursor when hovering
 * 
 * @param options - Configuration for magnetic strength and spring physics
 * @returns ref to attach to element, and motion values for x/y transforms
 */
export function useMagneticEffect(options: MagneticEffectOptions = {}) {
  const {
    strength = 0.3,
    damping = 20,
    stiffness = 300,
    disabled = false
  } = options;

  const ref = useRef<HTMLElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Motion values for cursor position relative to element
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring-animated values for smooth movement
  const springConfig = { damping, stiffness };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  useEffect(() => {
    if (disabled) return;

    const element = ref.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isHovered) return;

      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate distance from cursor to element center
      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Apply strength multiplier (0.3 = 30% of distance)
      mouseX.set(deltaX * strength);
      mouseY.set(deltaY * strength);
    };

    const handleMouseEnter = () => {
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      // Reset to center with spring animation
      mouseX.set(0);
      mouseY.set(0);
    };

    element.addEventListener("mouseenter", handleMouseEnter);
    element.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      element.removeEventListener("mouseenter", handleMouseEnter);
      element.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [mouseX, mouseY, strength, isHovered, disabled]);

  return { ref, x, y, isHovered };
}

/**
 * Hook that detects if user prefers reduced motion
 * Used to disable magnetic effects for accessibility
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook that detects if device supports hover (desktop)
 * Magnetic effect disabled on touch devices
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px) and (hover: hover)");
    setIsDesktop(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}
