'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from './OnboardingProvider';
import { getTourGroups } from '@/lib/onboarding/tour-steps';
import { getTourSteps } from '@/lib/onboarding/tour-steps';

export function WelcomeModal() {
  const {
    shouldShowWelcome,
    shouldShowVersionUpdate,
    startTour,
    skipTour,
    dismissWelcome,
    progress,
  } = useOnboarding();

  const isVisible = shouldShowWelcome || shouldShowVersionUpdate;
  const groups = getTourGroups();
  const totalSteps = getTourSteps().length;
  const isResume = progress?.lastStepSeen && !progress.completedAt && !progress.skippedAt;
  const isVersionUpdate = shouldShowVersionUpdate;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="onboarding-welcome-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="onboarding-welcome-modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="onboarding-welcome-header">
              <motion.div
                className="onboarding-welcome-flame"
                animate={{ 
                  y: [0, -6, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                🔥
              </motion.div>
              <h1 className="onboarding-welcome-title">
                {isVersionUpdate
                  ? 'New Features Available!'
                  : isResume
                    ? 'Welcome Back!'
                    : 'Welcome to Backyard BBQ King'}
              </h1>
              <p className="onboarding-welcome-subtitle">
                {isVersionUpdate
                  ? 'Your platform has been updated with new features. Take a quick tour to see what\'s new.'
                  : isResume
                    ? 'Ready to continue where you left off? Your progress has been saved.'
                    : 'Let\'s walk you through everything your admin dashboard can do.'}
              </p>
            </div>

            {/* Section overview */}
            <div className="onboarding-welcome-sections">
              <div className="onboarding-welcome-sections-title">
                What we&apos;ll cover:
              </div>
              <div className="onboarding-welcome-grid">
                {groups.map((group, index) => (
                  <motion.div
                    key={group.id}
                    className="onboarding-welcome-section-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.04, duration: 0.3 }}
                  >
                    <span className="onboarding-welcome-section-icon">{group.icon}</span>
                    <span className="onboarding-welcome-section-label">{group.label}</span>
                    <span className="onboarding-welcome-section-count">{group.stepCount} steps</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Time estimate */}
            <div className="onboarding-welcome-estimate">
              <span className="onboarding-welcome-estimate-icon">⏱</span>
              <span>{totalSteps} steps · About 5 minutes</span>
            </div>

            {/* Actions */}
            <div className="onboarding-welcome-actions">
              <motion.button
                className="btn btn-primary btn-lg onboarding-welcome-start"
                onClick={startTour}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {isResume ? '▶ Continue Tour' : isVersionUpdate ? '🆕 See What\'s New' : '🚀 Start Tour'}
              </motion.button>
              <button
                className="btn btn-ghost btn-sm onboarding-welcome-skip"
                onClick={skipTour}
              >
                Skip for now
              </button>
              <button
                className="btn btn-ghost btn-sm onboarding-welcome-explore"
                onClick={dismissWelcome}
              >
                I&apos;ll explore on my own
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
