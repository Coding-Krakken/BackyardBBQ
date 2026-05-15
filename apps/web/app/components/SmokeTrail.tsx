"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  velocityY: number;
  velocityX: number;
  life: number;
  maxLife: number;
}

interface SmokeTrailProps {
  disabled?: boolean;
  maxParticles?: number;
  particleLifespan?: number;
}

/**
 * Canvas-based smoke trail that follows cursor
 * Premium atmospheric effect for hero sections
 * Auto-disabled on mobile and reduced motion
 */
export function SmokeTrail({ 
  disabled = false,
  maxParticles = 30,
  particleLifespan = 60 
}: SmokeTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const lastEmitRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Track mouse position
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Animation loop
    const animate = (time: number) => {
      if (!ctx || !canvas) return;

      // Clear canvas fully each frame to avoid dark buildup
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Emit new particles (throttled)
      if (time - lastEmitRef.current > 50 && particlesRef.current.length < maxParticles) {
        particlesRef.current.push({
          x: mouseRef.current.x,
          y: mouseRef.current.y,
          size: Math.random() * 15 + 5,
          opacity: 0.3,
          velocityY: -Math.random() * 0.5 - 0.2,
          velocityX: (Math.random() - 0.5) * 0.5,
          life: 0,
          maxLife: particleLifespan,
        });
        lastEmitRef.current = time;
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((particle) => {
        particle.life++;
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.size += 0.2;
        particle.opacity = Math.max(0, 0.3 * (1 - particle.life / particle.maxLife));

        // Draw particle with gradient
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size
        );
        gradient.addColorStop(0, `rgba(120, 120, 120, ${particle.opacity})`);
        gradient.addColorStop(0.5, `rgba(100, 100, 100, ${particle.opacity * 0.5})`);
        gradient.addColorStop(1, `rgba(80, 80, 80, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        // Keep particle if still alive
        return particle.life < particle.maxLife;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [disabled, maxParticles, particleLifespan]);

  if (disabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
        mixBlendMode: "screen",
      }}
    />
  );
}
