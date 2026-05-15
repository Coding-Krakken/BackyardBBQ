"use client";

import { useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface TouchRippleProps {
  children: ReactNode;
  className?: string;
  color?: string;
  duration?: number;
  disabled?: boolean;
}

/**
 * Touch ripple effect component
 * Material Design-inspired ripple animation for touch feedback
 * Automatically triggered on touch/click events
 */
export function TouchRipple({ 
  children, 
  className = "", 
  color = "rgba(217, 109, 49, 0.3)",
  duration = 0.6,
  disabled = false 
}: TouchRippleProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [nextId, setNextId] = useState(0);

  const addRipple = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (disabled) return;

    const rect = event.currentTarget.getBoundingClientRect();
    let x: number, y: number;

    if ('touches' in event) {
      // Touch event
      const touch = event.touches[0];
      if (!touch) return; // Guard against undefined
      x = touch.clientX - rect.left;
      y = touch.clientY - rect.top;
    } else {
      // Mouse event
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }

    const newRipple: Ripple = {
      id: nextId,
      x,
      y,
    };

    setRipples((prev) => [...prev, newRipple]);
    setNextId((prev) => prev + 1);

    // Remove ripple after animation completes
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, duration * 1000);
  }, [nextId, duration, disabled]);

  return (
    <div
      className={className}
      onMouseDown={addRipple}
      onTouchStart={addRipple}
      style={{
        position: "relative",
        overflow: "hidden",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{
              scale: 0,
              opacity: 1,
            }}
            animate={{
              scale: 4,
              opacity: 0,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: duration,
              ease: "easeOut",
            }}
            style={{
              position: "absolute",
              left: ripple.x,
              top: ripple.y,
              width: 20,
              height: 20,
              borderRadius: "50%",
              backgroundColor: color,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
