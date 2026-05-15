"use client";

import { useState, useEffect } from "react";
import {
  CinematicBreakSection,
  FeaturedMenuSection,
  FinalCtaSection,
  HeroSection,
  QuickInfoSection,
  SiteFooter,
  StorySection,
  TestimonialsSection,
  WhyUsSection
} from "./components/HomeSections";
import { SiteNavbar } from "./components/SiteNavbar";
import { SmokeTrail } from "./components/SmokeTrail";

export default function HomePage() {
  // Disable smoke trail on mobile and reduced motion
  const [disableSmokeTrail, setDisableSmokeTrail] = useState(true);
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setDisableSmokeTrail(isMobile || prefersReducedMotion);
  }, []);

  return (
    <main id="main-content" className="site-main">
      <SmokeTrail disabled={disableSmokeTrail} maxParticles={20} particleLifespan={50} />
      <SiteNavbar />
      <div className="home-shell">
        <HeroSection />
        <StorySection />
        <QuickInfoSection />
        <FeaturedMenuSection />
        <CinematicBreakSection />
        <TestimonialsSection />
        <WhyUsSection />
        <FinalCtaSection />
        <SiteFooter />
      </div>
    </main>
  );
}
