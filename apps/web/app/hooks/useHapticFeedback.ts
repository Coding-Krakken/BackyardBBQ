"use client";

/**
 * Haptic feedback hook for touch interactions
 * Provides tactile feedback on supported mobile devices
 * Gracefully degrades on unsupported browsers
 */

type HapticPattern = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 50,
  selection: [5, 5],
  success: [10, 50, 10],
  warning: [20, 100, 20],
  error: [50, 100, 50, 100, 50],
};

function triggerVibration(pattern: HapticPattern) {
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[pattern]);
  } catch {
    // Silently fail - haptic feedback is progressive enhancement
  }
}

export function useHapticFeedback() {
  const vibrate = (pattern: HapticPattern = "light") => {
    triggerVibration(pattern);
  };

  return { vibrate };
}

/**
 * Higher-order function to add haptic feedback to callbacks
 * Usage: <Button onClick={withHaptic(() => doSomething(), "medium")} />
 */
export function withHaptic(callback: () => void, pattern: HapticPattern = "light") {
  return () => {
    triggerVibration(pattern);
    callback();
  };
}
