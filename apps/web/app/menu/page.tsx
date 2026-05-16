import { prisma } from '../../lib/prisma';
import { SiteNavbar } from '../components/SiteNavbar';
import { SiteFooter } from '../components/HomeSections';
import { MenuClient } from './MenuClient';
import { CATEGORIES } from '../config/constants';

export const metadata = {
  title: 'Menu',
  description: 'Browse our full menu of premium BBQ items, sides, drinks, and more.'
};

export default async function MenuPage() {
  // Fetch all available menu items from database
  const menuItems = await prisma.menuItem.findMany({
    where: {
      isAvailable: true
    },
    orderBy: [
      { category: 'asc' },
      { sortOrder: 'asc' },
      { name: 'asc' }
    ],
    select: {
      id: true,
      name: true,
      description: true,
      basePriceCents: true,
      imageUrl: true,
      category: true,
      sortOrder: true,
      customizations: true,
      location: {
        select: {
          name: true
        }
      }
    }
  });

  // Group items by category
  const itemsByCategory = CATEGORIES.map(cat => ({
    category: cat.value,
    label: cat.label,
    items: menuItems.filter((item: any) => item.category === cat.value)
  })).filter(group => group.items.length > 0);

  return (
    <main id="main-content">
      <SiteNavbar />
      
      <section className="page-shell section menu-hero">
        <div className="menu-hero-content">
          <span className="hero-eyebrow">Full Menu</span>
          <h1>Slow-Smoked BBQ, Sides & More</h1>
          <p>
            Browse our complete menu of Texas-style smoked meats, hand-crafted sides, and refreshing beverages.
            All items available for dine-in, takeout, and catering.
          </p>
        </div>
      </section>

      <MenuClient itemsByCategory={itemsByCategory} />
      
      <SiteFooter />
      
      <style jsx>{`
        .menu-hero {
          padding-top: 3rem;
          padding-bottom: 2rem;
          text-align: center;
        }
        
        .menu-hero-content {
          max-width: 700px;
          margin: 0 auto;
        }
        
        .hero-eyebrow {
          display: inline-block;
          font-size: 0.875rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-accent, #ff6b35);
          margin-bottom: 1rem;
        }
        
        .menu-hero h1 {
          font-size: 3rem;
          margin-bottom: 1rem;
          line-height: 1.2;
        }
        
        .menu-hero p {
          font-size: 1.125rem;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.6;
        }
        
        @media (max-width: 768px) {
          .menu-hero h1 {
            font-size: 2rem;
          }
          
          .menu-hero p {
            font-size: 1rem;
          }
        }
      `}</style>
    </main>
  );
}
