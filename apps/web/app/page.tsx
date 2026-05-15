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
  return (
    <main id="main-content" className="site-main">
      <SmokeTrail maxParticles={20} particleLifespan={50} />
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
