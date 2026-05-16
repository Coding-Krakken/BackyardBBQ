import { prisma } from '../../lib/prisma';
import { SiteNavbar } from '../components/SiteNavbar';
import { SiteFooter } from '../components/HomeSections';
import { MenuClient } from './MenuClient';
import { CATEGORIES } from '../config/constants';
import styles from './menu.module.css';

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
      
      <section className={`page-shell section ${styles.menuHero}`}>
        <div className={styles.menuHeroContent}>
          <span className={styles.heroEyebrow}>Full Menu</span>
          <h1>Slow-Smoked BBQ, Sides & More</h1>
          <p>
            Browse our complete menu of Texas-style smoked meats, hand-crafted sides, and refreshing beverages.
            All items available for dine-in, takeout, and catering.
          </p>
        </div>
      </section>

      <MenuClient itemsByCategory={itemsByCategory} />
      
      <SiteFooter />
    </main>
  );
}
