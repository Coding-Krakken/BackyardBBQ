'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface AnimatedPageProps {
  children: ReactNode;
}

export function AnimatedPage({ children }: AnimatedPageProps) {
  return (
    <motion.div
      className="page-padding"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
