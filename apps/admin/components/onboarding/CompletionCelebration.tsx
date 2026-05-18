'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from './OnboardingProvider';

function ConfettiParticle({ delay, x }: { delay: number; x: number }) {
  const colors = ['#d96d31', '#f0a468', '#5cb87a', '#5a9fd4', '#e0a832', '#b89258'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const rotation = Math.random() * 360;
  const size = 6 + Math.random() * 8;

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: '40%',
        width: size,
        height: size,
        background: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      }}
      initial={{ opacity: 0, y: 0, rotate: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [0, -120 - Math.random() * 80, -60 + Math.random() * 200],
        x: [0, (Math.random() - 0.5) * 200],
        rotate: [0, rotation, rotation * 2],
        scale: [0, 1, 0.6],
      }}
      transition={{
        duration: 2 + Math.random(),
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

export function CompletionCelebration() {
  const { progress } = useOnboarding();
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    // Show celebration when completedAt is set and we haven't shown it yet
    if (progress?.completedAt && !hasShown) {
      // Small delay after tour completion for smooth transition
      const timeout = setTimeout(() => {
        setShowCelebration(true);
        setHasShown(true);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [progress?.completedAt, hasShown]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (showCelebration) {
      const timeout = setTimeout(() => {
        setShowCelebration(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [showCelebration]);

  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: 10 + Math.random() * 80,
  }));

  return (
    <AnimatePresence>
      {showCelebration && (
        <motion.div
          className="onboarding-celebration-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setShowCelebration(false)}
        >
          {/* Confetti */}
          <div className="onboarding-celebration-confetti">
            {particles.map((p) => (
              <ConfettiParticle key={p.id} delay={p.delay} x={p.x} />
            ))}
          </div>

          <motion.div
            className="onboarding-celebration-card"
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="onboarding-celebration-emoji"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0],
              }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              🎉
            </motion.div>
            <h2 className="onboarding-celebration-title">You&apos;re All Set!</h2>
            <p className="onboarding-celebration-text">
              You now have a complete understanding of your Backyard BBQ King admin platform. 
              Time to fire up those grills!
            </p>
            <div className="onboarding-celebration-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowCelebration(false)}
              >
                Let&apos;s Go! 🔥
              </button>
            </div>
            <p className="onboarding-celebration-hint">
              You can restart the tour anytime from the sidebar.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
