"use client";

import { useEffect, useRef } from "react";

interface PerformanceMetrics {
  fps: number;
  avgFrameTime: number;
  droppedFrames: number;
}

/**
 * Performance monitoring hook for animations
 * Tracks FPS and frame timing to ensure 60fps target
 * Only active in development mode
 */
export function useAnimationPerformance(componentName: string = "Component") {
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const droppedFramesRef = useRef<number>(0);
  const rafIdRef = useRef<number>();

  useEffect(() => {
    // Only monitor in development
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    let frameCount = 0;
    const maxSamples = 60; // Track last 60 frames

    const measureFrame = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;

      // Record frame time
      frameTimesRef.current.push(deltaTime);
      if (frameTimesRef.current.length > maxSamples) {
        frameTimesRef.current.shift();
      }

      // Detect dropped frames (> 16.67ms = missed 60fps target)
      if (deltaTime > 16.67) {
        droppedFramesRef.current++;
      }

      frameCount++;

      // Log metrics every 60 frames (approx 1 second at 60fps)
      if (frameCount % 60 === 0) {
        const avgFrameTime =
          frameTimesRef.current.reduce((sum, time) => sum + time, 0) /
          frameTimesRef.current.length;
        const fps = Math.round(1000 / avgFrameTime);
        const droppedPercentage = ((droppedFramesRef.current / frameCount) * 100).toFixed(1);

        const metrics: PerformanceMetrics = {
          fps,
          avgFrameTime: Math.round(avgFrameTime * 100) / 100,
          droppedFrames: droppedFramesRef.current,
        };

        // Color-coded console logging
        const style = fps >= 55 ? "color: green" : fps >= 45 ? "color: orange" : "color: red";
        console.log(
          `%c[${componentName}] FPS: ${fps} | Avg: ${metrics.avgFrameTime}ms | Dropped: ${droppedPercentage}%`,
          style
        );

        // Warn if performance is poor
        if (fps < 45) {
          console.warn(
            `⚠️ ${componentName}: Poor animation performance detected. Consider simplifying animations.`
          );
        }
      }

      rafIdRef.current = requestAnimationFrame(measureFrame);
    };

    rafIdRef.current = requestAnimationFrame(measureFrame);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [componentName]);
}

/**
 * Performance budget checker
 * Warns if component render time exceeds threshold
 */
export function useRenderPerformance(
  componentName: string = "Component",
  budgetMs: number = 16.67
) {
  const renderStartRef = useRef<number>(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    renderStartRef.current = performance.now();

    return () => {
      const renderTime = performance.now() - renderStartRef.current;
      if (renderTime > budgetMs) {
        console.warn(
          `⚠️ ${componentName}: Render time ${renderTime.toFixed(2)}ms exceeded budget of ${budgetMs}ms`
        );
      }
    };
  });
}

/**
 * Bundle size checker - logs component lazy load time
 */
export function logLazyLoadTime(componentName: string) {
  const start = performance.now();
  return () => {
    const loadTime = performance.now() - start;
    console.log(`📦 ${componentName} lazy loaded in ${loadTime.toFixed(2)}ms`);
  };
}
