"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { durations, easings } from "../lib/animations";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Page transition wrapper using Framer Motion AnimatePresence
 * Provides smooth fade + slide transitions between route changes
 * 
 * Usage: Wrap page content or entire layout with <PageTransition>
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{
          duration: durations.fast,
          ease: easings.easeOut,
        }}
        style={{
          width: "100%",
          minHeight: "100vh",
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
