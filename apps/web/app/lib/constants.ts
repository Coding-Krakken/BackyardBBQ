/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

// ============================================================================
// ANIMATION CONSTANTS
// ============================================================================

export const ANIMATION_CONSTANTS = {
  // Scroll trigger margins for intersection observer
  SCROLL_TRIGGER_MARGIN: "-100px",
  SCROLL_TRIGGER_MARGIN_SMALL: "-50px",
  
  // Animation delays (in seconds)
  DELAY_NONE: 0,
  DELAY_SMALL: 0.1,
  DELAY_MEDIUM: 0.2,
  DELAY_LARGE: 0.3,
  DELAY_XL: 0.4,
  DELAY_XXL: 0.5,
  
  // Particle system
  PARTICLE_COUNT_DEFAULT: 25,
  PARTICLE_COUNT_REDUCED: 15,
  PARTICLE_SPEED_DEFAULT: 0.5,
  PARTICLE_SPEED_SLOW: 0.3,
  PARTICLE_LIFESPAN_DEFAULT: 60,
  
  // Smoke trail
  SMOKE_MAX_PARTICLES: 30,
  SMOKE_PARTICLE_LIFESPAN: 60,
  SMOKE_EMIT_THROTTLE_MS: 50,
  
  // Magnetic effect
  MAGNETIC_STRENGTH_DEFAULT: 0.3,
  MAGNETIC_STRENGTH_SUBTLE: 0.25,
  MAGNETIC_STRENGTH_STRONG: 0.5,
  
  // Responsive breakpoints
  MOBILE_MAX_WIDTH: 768,
  DESKTOP_MIN_WIDTH: 1024,
} as const;

// ============================================================================
// PERFORMANCE CONSTANTS
// ============================================================================

export const PERFORMANCE_CONSTANTS = {
  // Target FPS
  TARGET_FPS: 60,
  
  // Debounce delays (in milliseconds)
  DEBOUNCE_RESIZE: 200,
  DEBOUNCE_SCROLL: 100,
  DEBOUNCE_INPUT: 300,
  
  // Bundle size budgets (in KB, gzipped)
  BUNDLE_BUDGET_MAIN: 250,
  BUNDLE_BUDGET_VENDOR: 150,
  BUNDLE_BUDGET_ANIMATIONS: 50,
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

export const UI_CONSTANTS = {
  // Touch target minimum size (WCAG 2.1)
  MIN_TOUCH_TARGET_SIZE: 44,
  
  // Z-index layers
  Z_INDEX: {
    SMOKE_TRAIL: 50,
    NAVBAR: 100,
    MOBILE_NAV_BACKDROP: 98,
    MOBILE_NAV_DRAWER: 99,
    MODAL_BACKDROP: 999,
    MODAL_CONTENT: 1000,
  },
  
  // Animation feature flag
  ENABLE_PREMIUM_ANIMATIONS: process.env.NEXT_PUBLIC_ENABLE_ANIMATIONS !== "false",
} as const;

// ============================================================================
// RATE LIMITING CONSTANTS
// ============================================================================

export const RATE_LIMIT_CONSTANTS = {
  // Analytics endpoints
  ANALYTICS_REQUESTS_PER_MINUTE: 20,
  ANALYTICS_REQUESTS_PER_HOUR: 100,
  
  // Profile updates
  PROFILE_UPDATES_PER_MINUTE: 5,
  PROFILE_UPDATES_PER_HOUR: 20,
  
  // Support tickets
  TICKET_CREATION_PER_HOUR: 5,
  TICKET_CREATION_PER_DAY: 20,
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  UNAUTHORIZED: "You must be logged in to access this resource",
  FORBIDDEN: "You don't have permission to access this resource",
  NOT_FOUND: "The requested resource was not found",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later",
  SERVER_ERROR: "An unexpected error occurred. Please try again",
  NETWORK_ERROR: "Network error. Please check your connection",
  VALIDATION_ERROR: "Please check your input and try again",
} as const;
