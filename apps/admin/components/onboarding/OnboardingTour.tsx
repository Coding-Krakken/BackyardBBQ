'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { driver, type DriveStep, type Driver, type Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useOnboarding } from './OnboardingProvider';
import { getTourSteps, getTourGroups, type TourStep } from '@/lib/onboarding/tour-steps';

function buildDriverSteps(tourSteps: TourStep[]): DriveStep[] {
  const groups = getTourGroups();
  let globalIndex = 0;
  const totalSteps = tourSteps.length;

  return tourSteps.map((step) => {
    const currentIndex = globalIndex++;
    const group = groups.find((g) => g.id === step.group);
    const groupLabel = group?.label ?? step.group;
    const groupIcon = group?.icon ?? '';

    // Build progress bar HTML
    const progressPct = Math.round(((currentIndex + 1) / totalSteps) * 100);

    const headerHTML = `
      <div class="onboarding-popover-header">
        <div class="onboarding-popover-meta">
          <span class="onboarding-popover-group">${groupIcon} ${groupLabel}</span>
          <span class="onboarding-popover-counter">Step ${currentIndex + 1} of ${totalSteps}</span>
        </div>
        <div class="onboarding-popover-progress">
          <div class="onboarding-popover-progress-bar" style="width: ${progressPct}%"></div>
        </div>
      </div>
    `;

    const elementExists =
      typeof window !== 'undefined' && step.element
        ? Boolean(document.querySelector(step.element))
        : false;

    return {
      // If the selector no longer exists (UI changed), render as a centered step
      // so onboarding remains usable across iterative UI updates.
      element: elementExists ? step.element : undefined,
      popover: {
        title: step.popover.title,
        description: `${headerHTML}${step.popover.description}`,
        side: step.popover.side,
        align: step.popover.align ?? 'center',
      },
    };
  });
}

export function OnboardingTour() {
  const {
    isTourActive,
    setTourActive,
    reportStepComplete,
    reportStepSeen,
    completeTour,
    progress,
  } = useOnboarding();

  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const tourStepsRef = useRef<TourStep[]>([]);
  const currentStepIndexRef = useRef(0);
  const isNavigatingRef = useRef(false);
  const activeRef = useRef(false);

  // Cleanup function
  const destroyDriver = useCallback(() => {
    if (driverRef.current) {
      try {
        driverRef.current.destroy();
      } catch {
        // driver.js may throw if already destroyed
      }
      driverRef.current = null;
    }
  }, []);

  // Navigate to a page and continue tour from a specific step index
  const navigateAndContinue = useCallback(
    (targetPage: string, stepIndex: number) => {
      if (pathname === targetPage) {
        // Already on the right page, just drive
        startDriverFromStep(stepIndex);
        return;
      }

      isNavigatingRef.current = true;
      currentStepIndexRef.current = stepIndex;
      destroyDriver();
      router.push(targetPage);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, router, destroyDriver]
  );

  // Start driver.js from a specific step index
  const startDriverFromStep = useCallback(
    (fromIndex: number) => {
      destroyDriver();

      const tourSteps = tourStepsRef.current;
      const driverSteps = buildDriverSteps(tourSteps);

      // Find the range of steps for the current page
      const currentPage = pathname;
      const stepsFromIndex = driverSteps.slice(fromIndex);
      const tourStepsFromIndex = tourSteps.slice(fromIndex);

      // Find steps that are on the current page (or have no page requirement)
      const pageSteps: DriveStep[] = [];
      const pageStepIndices: number[] = [];

      for (let i = 0; i < stepsFromIndex.length; i++) {
        const tourStep = tourStepsFromIndex[i];
        if (!tourStep) break;
        const stepPage = tourStep.page;

        if (!stepPage || stepPage === currentPage) {
          pageSteps.push(stepsFromIndex[i]!);
          pageStepIndices.push(fromIndex + i);
        } else if (pageSteps.length > 0) {
          // Hit a step on a different page — stop collecting
          break;
        } else {
          // First step is on a different page — navigate there
          navigateAndContinue(stepPage, fromIndex + i);
          return;
        }
      }

      if (pageSteps.length === 0) {
        // No more steps — tour complete
        completeTour();
        return;
      }

      const nextPageStepIndex =
        pageStepIndices.length > 0
          ? (pageStepIndices[pageStepIndices.length - 1] ?? fromIndex) + 1
          : fromIndex;

      const config: Config = {
        showProgress: false,
        showButtons: ['next', 'previous', 'close'],
        nextBtnText: nextPageStepIndex >= tourSteps.length ? 'Finish' : 'Next →',
        prevBtnText: '← Back',
        doneBtnText: '🎉 Complete Tour',
        animate: true,
        overlayColor: 'rgba(4, 12, 20, 0.56)',
        stagePadding: 14,
        stageRadius: 14,
        popoverClass: 'onboarding-popover',
        steps: pageSteps,
        onDestroyStarted: () => {
          if (!activeRef.current) return;
          // User clicked the X or overlay
          const driverInstance = driverRef.current;
          if (driverInstance) {
            driverInstance.destroy();
          }
          driverRef.current = null;
          activeRef.current = false;
          setTourActive(false);
        },
        onNextClick: () => {
          const driverInstance = driverRef.current;
          if (!driverInstance) return;

          const activeIndex = driverInstance.getActiveIndex();
          if (activeIndex === undefined || activeIndex === null) return;

          const globalIdx = pageStepIndices[activeIndex];
          if (globalIdx !== undefined) {
            const step = tourSteps[globalIdx];
            if (step) {
              reportStepComplete(step.id);
              reportStepSeen(step.id);
            }
          }

          // Check if this is the last step on this page
          if (activeIndex >= pageSteps.length - 1) {
            // Need to go to next page or finish
            driverInstance.destroy();
            driverRef.current = null;

            if (nextPageStepIndex >= tourSteps.length) {
              // Tour complete!
              activeRef.current = false;
              completeTour();
            } else {
              const nextStep = tourSteps[nextPageStepIndex];
              if (nextStep?.page) {
                navigateAndContinue(nextStep.page, nextPageStepIndex);
              } else {
                startDriverFromStep(nextPageStepIndex);
              }
            }
          } else {
            driverInstance.moveNext();
          }
        },
        onPrevClick: () => {
          const driverInstance = driverRef.current;
          if (!driverInstance) return;

          const activeIndex = driverInstance.getActiveIndex();
          if (activeIndex === undefined || activeIndex === null) return;

          if (activeIndex <= 0) {
            // First step on this page — go to previous page
            const prevGlobalIdx = (pageStepIndices[0] ?? 1) - 1;
            if (prevGlobalIdx >= 0) {
              driverInstance.destroy();
              driverRef.current = null;
              const prevStep = tourSteps[prevGlobalIdx];
              if (prevStep?.page) {
                navigateAndContinue(prevStep.page, prevGlobalIdx);
              }
            }
          } else {
            driverInstance.movePrevious();
          }
        },
      };

      const driverInstance = driver(config);
      driverRef.current = driverInstance;

      // Small delay to ensure DOM is ready after navigation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (activeRef.current && driverRef.current) {
            driverInstance.drive();
          }
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pathname,
      destroyDriver,
      navigateAndContinue,
      completeTour,
      reportStepComplete,
      reportStepSeen,
      setTourActive,
    ]
  );

  // Handle tour activation
  useEffect(() => {
    if (isTourActive && !activeRef.current) {
      activeRef.current = true;
      tourStepsRef.current = getTourSteps();

      // Determine starting step
      let startIndex = 0;
      if (progress?.lastStepSeen) {
        const idx = tourStepsRef.current.findIndex(
          (s) => s.id === progress.lastStepSeen
        );
        if (idx >= 0 && idx < tourStepsRef.current.length - 1) {
          startIndex = idx + 1;
        }
      }

      const firstStep = tourStepsRef.current[startIndex];
      if (firstStep?.page) {
        navigateAndContinue(firstStep.page, startIndex);
      } else {
        startDriverFromStep(startIndex);
      }
    } else if (!isTourActive && activeRef.current) {
      activeRef.current = false;
      destroyDriver();
    }
  }, [isTourActive, progress?.lastStepSeen, navigateAndContinue, startDriverFromStep, destroyDriver]);

  // Handle page navigation completion
  useEffect(() => {
    if (isNavigatingRef.current && activeRef.current) {
      isNavigatingRef.current = false;
      // Wait for the page to render
      const timeout = setTimeout(() => {
        startDriverFromStep(currentStepIndexRef.current);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [pathname, startDriverFromStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyDriver();
    };
  }, [destroyDriver]);

  return null; // This component renders nothing — driver.js manages its own DOM
}
