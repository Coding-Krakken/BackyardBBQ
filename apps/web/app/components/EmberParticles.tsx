"use client";

import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { ISourceOptions } from "@tsparticles/engine";

interface EmberParticlesProps {
  density?: number; // Number of particles (default: 25)
  speed?: number; // Particle movement speed (default: 0.5)
  disabled?: boolean; // Disable on mobile or reduced motion
}

/**
 * Ember-themed particle effect component
 * Creates subtle floating ember particles with upward drift
 * Optimized for performance with slim tsParticles bundle
 */
export function EmberParticles({ 
  density = ANIMATION_CONSTANTS.PARTICLE_COUNT_DEFAULT, 
  speed = ANIMATION_CONSTANTS.PARTICLE_SPEED_DEFAULT,
  disabled = false 
}: EmberParticlesProps) {
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Initialize particles engine only once
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      if (!cancelled) setEngineReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const options: ISourceOptions = useMemo(
    () => ({
      background: {
        color: {
          value: "transparent",
        },
      },
      fpsLimit: 60,
      interactivity: {
        events: {
          onClick: {
            enable: false,
          },
          onHover: {
            enable: true,
            mode: "bubble",
          },
        },
        modes: {
          bubble: {
            distance: 100,
            duration: 2,
            opacity: 0.8,
            size: 8,
          },
        },
      },
      particles: {
        color: {
          value: ["#d96d31", "#f0a468", "#b89258"],
        },
        links: {
          enable: false,
        },
        move: {
          enable: true,
          speed: speed,
          direction: "top",
          random: true,
          straight: false,
          outModes: {
            default: "out",
            top: "out",
            bottom: "bounce",
          },
        },
        number: {
          density: {
            enable: true,
            width: 1920,
            height: 1080,
          },
          value: density,
        },
        opacity: {
          value: { min: 0.1, max: 0.5 },
          animation: {
            enable: true,
            speed: 1,
            startValue: "random",
            sync: false,
          },
        },
        shape: {
          type: "circle",
        },
        size: {
          value: { min: 2, max: 6 },
        },
        wobble: {
          enable: true,
          distance: 10,
          speed: 3,
        },
      },
      detectRetina: true,
      smooth: true,
      zLayers: 1,
    }),
    [density, speed]
  );

  if (disabled || !engineReady) {
    return null;
  }

  return (
    <Particles
      id="ember-particles"
      options={options}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}

// Feature flag check
if (!UI_CONSTANTS.ENABLE_PREMIUM_ANIMATIONS) {
  // Override to always return null if animations are disabled
  EmberParticles.prototype.render = function() { return null; };
}
