import {
  CateringSalesSection,
  CinematicBreakSection,
  FeaturedMenuSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  OrderingHubSection,
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
  let featuredItems: Array<{
    id: string;
    name: string;
    description: string | null;
    basePriceCents: number;
    imageUrl: string | null;
  }> = [];

  try {
    featuredItems = await prisma.menuItem.findMany({
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
  } catch {
    featuredItems = [];
  }

  return (
    <main id="main-content" className="site-main">
      <SmokeTrail maxParticles={20} particleLifespan={50} />
      <SiteNavbar />
      <div className="home-shell">
        <HeroSection />
        <StorySection />
        <QuickInfoSection />
        <HowItWorksSection />
        <FeaturedMenuSection items={featuredItems} />
        <CateringSalesSection />
        <OrderingHubSection />
        <CinematicBreakSection />
        <TestimonialsSection />
        <WhyUsSection />
        <FinalCtaSection />
        <SiteFooter />
      </div>
    </main>
  );
}
