"use client";

/**
 * Haptic feedback hook for touch interactions
 * Provides tactile feedback on supported mobile devices
 * Gracefully degrades on unsupported browsers
 */

type HapticPattern = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

export function useHapticFeedback() {
  const vibrate = (pattern: HapticPattern = "light") => {
    // Check if Vibration API is supported
    if (!("vibrate" in navigator)) {
      return;
    }

    // Pattern mapping (in milliseconds)
    const patterns: Record<HapticPattern, number | number[]> = {
      light: 10,
      medium: 20,
      heavy: 50,
      selection: [5, 5],
      success: [10, 50, 10],
      warning: [20, 100, 20],
      error: [50, 100, 50, 100, 50],
    };

    const vibrationPattern = patterns[pattern];
    
    try {
      navigator.vibrate(vibrationPattern);
    } catch (error) {
      // Silently fail - haptic feedback is progressive enhancement
      console.debug("Haptic feedback not supported", error);
    }
  };

  return { vibrate };
}

/**
 * Higher-order component to add haptic feedback to buttons
 * Usage: <Button onClick={withHaptic(() => doSomething(), "medium")} />
 */
export function withHaptic(callback: () => void, pattern: HapticPattern = "light") {
  return () => {
    // Trigger haptic
    if ("vibrate" in navigator) {
      const patterns: Record<HapticPattern, number | number[]> = {
        light: 10,
        medium: 20,
        heavy: 50,
        selection: [5, 5],
        success: [10, 50, 10],
        warning: [20, 100, 20],
        error: [50, 100, 50, 100, 50],
      };
      try {
        navigator.vibrate(patterns[pattern]);
      } catch (error) {
        // Silent failure
      }
    }
    // Execute callback
    callback();
  };
}
