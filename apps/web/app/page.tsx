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

export default function HomePage() {
  return (
    <main id="main-content" className="site-main">
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
