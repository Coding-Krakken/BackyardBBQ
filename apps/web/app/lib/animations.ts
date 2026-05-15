/**
 * Animation utilities and constants for Framer Motion
 * Provides reusable easing functions, transition configs, and animation variants
 */

import type { Transition, Variant } from "framer-motion";

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

/**
 * Custom easing functions for smooth, brand-appropriate animations
 */
export const easings = {
  // Smooth ease out (good for entrances)
  easeOut: [0.22, 1, 0.36, 1],
  
  // Spring-like ease (good for micro-interactions)
  spring: [0.16, 1, 0.3, 1],
  
  // Ember glow (custom for pulsing effects)
  emberPulse: [0.4, 0, 0.2, 1],
  
  // Smooth ease in-out (good for page transitions)
  smooth: [0.45, 0, 0.15, 1],
} as const;

// ============================================================================
// SPRING CONFIGURATIONS
// ============================================================================

/**
 * Pre-configured spring physics for different interaction types
 */
export const springs = {
  // Responsive button spring
  button: {
    type: "spring" as const,
    stiffness: 400,
    damping: 17,
  },
  
  // Bouncy notification badge
  bounce: {
    type: "spring" as const,
    stiffness: 300,
    damping: 10,
  },
  
  // Smooth layout shifts
  layout: {
    type: "spring" as const,
    stiffness: 200,
    damping: 25,
  },
  
  // Gentle hover effects
  gentle: {
    type: "spring" as const,
    stiffness: 150,
    damping: 20,
  },
} as const;

// ============================================================================
// DURATION CONSTANTS
// ============================================================================

/**
 * Standard animation durations (in seconds)
 */
export const durations = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  verySlow: 0.8,
  countUp: 2,
} as const;

// ============================================================================
// TRANSITION PRESETS
// ============================================================================

/**
 * Pre-configured transitions for common use cases
 */
export const transitions = {
  // Fast fade (buttons, small elements)
  fastFade: {
    duration: durations.fast,
    ease: easings.easeOut,
  },
  
  // Normal smooth transition
  smooth: {
    duration: durations.normal,
    ease: easings.smooth,
  },
  
  // Slow entrance (sections, large elements)
  slowEntrance: {
    duration: durations.verySlow,
    ease: easings.easeOut,
  },
  
  // Button spring
  buttonSpring: springs.button,
  
  // Layout animation
  layout: springs.layout,
} as const;

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

/**
 * Reusable animation variants for Framer Motion
 */

// Fade in from bottom
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
} as const;

// Fade in from top
export const fadeInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
} as const;

// Scale and fade
export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
} as const;

// Slide in from right
export const slideInRight = {
  initial: { opacity: 0, x: 100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -100 },
} as const;

// Slide in from left
export const slideInLeft = {
  initial: { opacity: 0, x: -100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 100 },
} as const;

// Smoke rise effect (BBQ brand-specific)
export const smokeRise = {
  initial: { opacity: 0, y: 40, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -20, filter: "blur(5px)" },
} as const;

// Stagger container (for grids)
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} as const;

// Stagger item (child of stagger container)
export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: durations.slow,
      ease: easings.easeOut,
    },
  },
} as const;

// Page transition
export const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.98,
    transition: {
      duration: durations.fast,
      ease: easings.smooth,
    },
  },
} as const;

// ============================================================================
// VIEWPORT INTERSECTION OPTIONS
// ============================================================================

/**
 * IntersectionObserver options for scroll-triggered animations
 */
export const viewportOptions = {
  // Trigger just before element enters viewport
  anticipate: {
    once: true,
    margin: "-100px",
    amount: 0.2,
  },
  
  // Trigger when element is mostly visible
  majority: {
    once: true,
    margin: "0px",
    amount: 0.5,
  },
  
  // Trigger when any part enters
  any: {
    once: true,
    margin: "0px",
    amount: 0,
  },
  
  // Repeat animation on every intersection
  repeat: {
    once: false,
    margin: "-50px",
    amount: 0.3,
  },
} as const;

// ============================================================================
// HOVER/TAP ANIMATIONS
// ============================================================================

/**
 * Common hover and tap animations for interactive elements
 */
export const hoverTap = {
  // Button with lift effect
  liftButton: {
    whileHover: { scale: 1.05, y: -2 },
    whileTap: { scale: 0.98, y: 0 },
    transition: springs.button,
  },
  
  // Card with subtle lift
  liftCard: {
    whileHover: { y: -5, scale: 1.02 },
    whileTap: { scale: 0.99 },
    transition: springs.gentle,
  },
  
  // Scale only (no lift)
  scale: {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: springs.button,
  },
  
  // Gentle scale
  gentleScale: {
    whileHover: { scale: 1.03 },
    whileTap: { scale: 0.97 },
    transition: springs.gentle,
  },
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Get transition based on reduced motion preference
 */
export function getTransition(transition: Transition): Transition {
  return prefersReducedMotion() ? { duration: 0 } : transition;
}

/**
 * Get variants with reduced motion support
 */
export function getVariants(variants: { initial: Variant; animate: Variant; exit?: Variant }) {
  if (prefersReducedMotion()) {
    return {
      initial: variants.animate,
      animate: variants.animate,
      exit: variants.animate,
    };
  }
  return variants;
}
