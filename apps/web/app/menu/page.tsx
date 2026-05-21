import { prisma } from '../../lib/prisma';
import { SiteNavbar } from '../components/SiteNavbar';
import { SiteFooter } from '../components/HomeSections';
import { MenuClient } from './MenuClient';
import { featureFlags } from '../config/content';
import styles from './menu.module.css';

export const metadata = {
  title: 'Menu',
  description: 'Browse our full menu of premium BBQ items, sides, drinks, and more.'
};

// Revalidate every 60 seconds to show fresh menu data
export const revalidate = 60;

export default async function MenuPage() {
  type MenuListItem = {
    id: string;
    name: string;
    description: string;
    basePriceCents: number;
    imageUrl: string | null;
    category: string;
    sortOrder: number;
    customizations: unknown;
    location: { name: string };
  };

  type RawMenuListItem = Omit<MenuListItem, "location"> & {
    location: { name: string } | null;
  };

  let menuItems: MenuListItem[] = [];

  try {
    const rows = (await prisma.menuItem.findMany({
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
    })) as RawMenuListItem[];

    menuItems = rows.map((item) => ({
      ...item,
      location: item.location ?? { name: "Backyard BBQ King" }
    }));
  } catch {
    menuItems = [];
  }

  const uniqueCategories = Array.from(new Set(menuItems.map((item) => String(item.category))));

  // Group items by existing database category for visual sectioning.
  const itemsByCategory = uniqueCategories.map((category) => ({
    category,
    label: String(category)
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    items: menuItems.filter((item) => item.category === category)
  }));

  return (
    <main id="main-content">
      <SiteNavbar />
      
      <section className={`page-shell section ${styles.menuHero}`}>
        <div className={styles.menuHeroContent}>
          <span className={styles.heroEyebrow}>Full Menu</span>
          <h1>Slow-Smoked BBQ, Sides & More</h1>
          <p>
            Browse our complete menu of Texas-style smoked meats, hand-crafted sides, and refreshing beverages.
            All items available for {featureFlags.isDineInEnabled ? 'dine-in, takeout, and catering' : 'takeout and catering'}.
          </p>
        </div>
      </section>

      <MenuClient itemsByCategory={itemsByCategory} />
      
      <SiteFooter />
    </main>
  );
}
