'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import { getFeatureVersion } from '@/lib/onboarding/dynamic-content';

interface OnboardingProgress {
  id: string;
  completedSteps: string[];
  lastStepSeen: string | null;
  tourVersion: number;
  completedAt: string | null;
  skippedAt: string | null;
}

interface OnboardingContextValue {
  isLoading: boolean;
  progress: OnboardingProgress | null;
  shouldShowWelcome: boolean;
  shouldShowVersionUpdate: boolean;
  isTourActive: boolean;
  startTour: () => void;
  skipTour: () => Promise<void>;
  completeTour: () => Promise<void>;
  resetTour: () => Promise<void>;
  reportStepComplete: (stepId: string) => void;
  reportStepSeen: (stepId: string) => void;
  setTourActive: (active: boolean) => void;
  dismissWelcome: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  isLoading: true,
  progress: null,
  shouldShowWelcome: false,
  shouldShowVersionUpdate: false,
  isTourActive: false,
  startTour: () => {},
  skipTour: async () => {},
  completeTour: async () => {},
  resetTour: async () => {},
  reportStepComplete: () => {},
  reportStepSeen: () => {},
  setTourActive: () => {},
  dismissWelcome: () => {},
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [shouldShowWelcome, setShouldShowWelcome] = useState(false);
  const [shouldShowVersionUpdate, setShouldShowVersionUpdate] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [pendingSteps, setPendingSteps] = useState<string[]>([]);
  const [pendingLastStep, setPendingLastStep] = useState<string | null>(null);

  const userRole = (session?.user as { role?: string })?.role;
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  // Fetch onboarding progress on mount
  useEffect(() => {
    if (!session?.user || !isOwnerOrAdmin) {
      setIsLoading(false);
      return;
    }

    async function fetchProgress() {
      try {
        const res = await fetch('/api/admin/onboarding');
        if (!res.ok) {
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        const prog: OnboardingProgress | null = data.progress;

        setProgress(prog);

        if (!prog) {
          // First login ever — show welcome
          setShouldShowWelcome(true);
        } else if (!prog.completedAt && !prog.skippedAt) {
          // Started but not finished — resume
          setShouldShowWelcome(true);
        } else if (prog.completedAt && prog.tourVersion < getFeatureVersion()) {
          // Completed an older version — offer update
          setShouldShowVersionUpdate(true);
        }
      } catch {
        // Silently fail — don't block the dashboard
      } finally {
        setIsLoading(false);
      }
    }

    fetchProgress();
  }, [session, isOwnerOrAdmin]);

  // Debounced progress save
  useEffect(() => {
    if (pendingSteps.length === 0 && !pendingLastStep) return;

    const timeout = setTimeout(async () => {
      try {
        const body: Record<string, unknown> = {};
        if (pendingSteps.length > 0) {
          const current = progress?.completedSteps ?? [];
          const merged = Array.from(new Set([...current, ...pendingSteps]));
          body.completedSteps = merged;
        }
        if (pendingLastStep) {
          body.lastStepSeen = pendingLastStep;
        }

        const res = await fetch('/api/admin/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          setProgress(data.progress);
        }
      } catch {
        // Silently fail
      }

      setPendingSteps([]);
      setPendingLastStep(null);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [pendingSteps, pendingLastStep, progress?.completedSteps]);

  const startTour = useCallback(() => {
    setShouldShowWelcome(false);
    setShouldShowVersionUpdate(false);
    setIsTourActive(true);
  }, []);

  const skipTour = useCallback(async () => {
    setShouldShowWelcome(false);
    setShouldShowVersionUpdate(false);
    setIsTourActive(false);
    try {
      const res = await fetch('/api/admin/onboarding/skip', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const completeTour = useCallback(async () => {
    setIsTourActive(false);
    try {
      const res = await fetch('/api/admin/onboarding/complete', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const resetTour = useCallback(async () => {
    setIsTourActive(false);
    try {
      const res = await fetch('/api/admin/onboarding/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress);
        setShouldShowWelcome(true);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const reportStepComplete = useCallback((stepId: string) => {
    setPendingSteps((prev) => [...prev, stepId]);
  }, []);

  const reportStepSeen = useCallback((stepId: string) => {
    setPendingLastStep(stepId);
  }, []);

  const setTourActive = useCallback((active: boolean) => {
    setIsTourActive(active);
  }, []);

  const dismissWelcome = useCallback(() => {
    setShouldShowWelcome(false);
    setShouldShowVersionUpdate(false);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        isLoading,
        progress,
        shouldShowWelcome,
        shouldShowVersionUpdate,
        isTourActive,
        startTour,
        skipTour,
        completeTour,
        resetTour,
        reportStepComplete,
        reportStepSeen,
        setTourActive,
        dismissWelcome,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
