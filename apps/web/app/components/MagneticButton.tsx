"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { useMagneticEffect, usePrefersReducedMotion, useIsDesktop } from "../hooks/useMagneticEffect";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
  as?: "button" | "div" | "a";
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  target?: string;
  rel?: string;
}

/**
 * Button wrapper with magnetic cursor effect
 * Element subtly moves toward cursor on hover (desktop only)
 * Respects prefers-reduced-motion and touch devices
 */
export function MagneticButton({
  children,
  className,
  strength = 0.3,
  as: Component = "div",
  href,
  onClick,
  disabled,
  target,
  rel
}: MagneticButtonProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isDesktop = useIsDesktop();
  
  // Disable magnetic effect on mobile, touch devices, or if user prefers reduced motion
  const magneticDisabled = !isDesktop || prefersReducedMotion || disabled;
  
  const { ref, x, y } = useMagneticEffect({
    strength,
    damping: 20,
    stiffness: 300,
    disabled: magneticDisabled
  });

  const MotionComponent = motion[Component as keyof typeof motion] as any;

  return (
    <MotionComponent
      ref={ref}
      className={className}
      style={magneticDisabled ? {} : { x, y }}
      href={href}
      onClick={onClick}
      target={target}
      rel={rel}
    >
      {children}
    </MotionComponent>
  );
}
