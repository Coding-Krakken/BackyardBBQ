'use client';

import { useOnboarding } from './OnboardingProvider';

export function RestartTourButton() {
  const { resetTour, isLoading } = useOnboarding();

  if (isLoading) return null;

  return (
    <button
      className="onboarding-restart-btn"
      onClick={resetTour}
      title="Restart onboarding tour"
      aria-label="Restart onboarding tour"
    >
      <span className="onboarding-restart-icon">↻</span>
      <span className="onboarding-restart-label">Restart Tour</span>
    </button>
  );
}
