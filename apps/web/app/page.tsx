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
import { prisma } from "../lib/prisma";

export default async function HomePage() {
  // Fetch featured menu items from database
  const featuredItems = await prisma.menuItem.findMany({
    where: {
      isFeatured: true,
      isAvailable: true
    },
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' }
    ],
    take: 4,
    select: {
      id: true,
      name: true,
      description: true,
      basePriceCents: true,
      imageUrl: true
    }
  });

  return (
    <main id="main-content" className="site-main">
      <SmokeTrail maxParticles={20} particleLifespan={50} />
      <SiteNavbar />
      <div className="home-shell">
        <HeroSection />
        <StorySection />
        <QuickInfoSection />
        <FeaturedMenuSection items={featuredItems} />
        <CinematicBreakSection />
        <TestimonialsSection />
        <WhyUsSection />
        <FinalCtaSection />
        <SiteFooter />
      </div>
    </main>
  );
}
