'use client';

import { useMemo, useState } from 'react';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { MenuItemModal } from '../components/menu/MenuItemModal';
import { CategoryNav } from '../components/menu/CategoryNav';
import { MENU_BADGES } from '../config/constants';
import { useCart } from '../components/cart/CartContext';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  imageUrl: string | null;
  category: string;
  sortOrder: number;
  customizations: unknown;
  location: { name: string };
}

interface CategoryGroup {
  category: string;
  label: string;
  items: MenuItem[];
}

interface MenuClientProps {
  itemsByCategory: CategoryGroup[];
}

export function MenuClient({ itemsByCategory }: MenuClientProps) {
  const { dispatch } = useCart();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allItems = useMemo(() => itemsByCategory.flatMap((group) => group.items), [itemsByCategory]);

  const normalize = (value: string | null) => (value ?? '').toLowerCase();

  const categorizeForFilter = (item: MenuItem) => normalize(item.category);

  const navCategories = useMemo(
    () => itemsByCategory.map((group) => ({ value: group.category, label: group.label })),
    [itemsByCategory]
  );

  const getBadges = (item: MenuItem) => {
    const haystack = `${normalize(item.name)} ${normalize(item.description)}`;
    const badges: string[] = [];

    if (haystack.includes('spicy') || haystack.includes('chili') || haystack.includes('hot')) {
      badges.push(MENU_BADGES.spicy);
    }
    if (haystack.includes('brisket') || haystack.includes('burnt end') || haystack.includes('signature')) {
      badges.push(MENU_BADGES.pitmasterFavorite);
    }
    if (haystack.includes('gluten') || haystack.includes('protein plate') || haystack.includes('smoked chicken')) {
      badges.push(MENU_BADGES.glutenConscious);
    }
    if (item.sortOrder <= 2 || haystack.includes('best seller') || haystack.includes('popular')) {
      badges.push(MENU_BADGES.popular);
    }

    return [...new Set(badges)];
  };

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const withinCategory = activeCategory === 'all' || categorizeForFilter(item) === activeCategory;
      const search = searchQuery.trim().toLowerCase();
      const withinSearch =
        search.length === 0 ||
        item.name.toLowerCase().includes(search) ||
        (item.description ?? '').toLowerCase().includes(search);
      return withinCategory && withinSearch;
    });
  }, [activeCategory, allItems, searchQuery]);

  const filteredCategories = useMemo(
    () =>
      itemsByCategory
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => filteredItems.some((candidate) => candidate.id === item.id))
        }))
        .filter((group) => group.items.length > 0),
    [filteredItems, itemsByCategory]
  );

  const addBaseItemToCart = (item: MenuItem) => {
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        menuItemId: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        unitPriceCents: item.basePriceCents,
        quantity: 1,
        customizations: [],
        notes: ''
      }
    });

    trackEvent(AnalyticsEvents.menuItemAddedToCart, {
      itemId: item.id,
      itemName: item.name,
      source: 'menu_card'
    });
  };

  const totalResults = filteredItems.length;

  return (
    <>
      <section className="page-shell menu-search-shell" aria-label="Menu search">
        <label className="menu-search-label" htmlFor="menu-search-input">
          Search Menu
        </label>
        <input
          id="menu-search-input"
          className="menu-search-input"
          placeholder="Search combos, meats, sides, drinks, and more"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </section>

      <CategoryNav
        categories={navCategories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      
      <section className="page-shell section menu-grid-section">
        <p className="menu-result-count">{totalResults} item{totalResults === 1 ? '' : 's'} found</p>

        {filteredCategories.length === 0 ? (
          <div className="panel menu-empty-state">
            <h2>No menu items match your filters</h2>
            <p>Try another category or search for brisket, ribs, sandwiches, or sides.</p>
            <button className="btn btn-secondary" onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}>
              Reset Filters
            </button>
          </div>
        ) : null}

        {filteredCategories.map(categoryGroup => (
          <div key={categoryGroup.category} id={categoryGroup.category} className="category-section">
            <h2 className="category-title">{categoryGroup.label}</h2>
            <div className="menu-grid">
              {categoryGroup.items.map(item => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  badges={getBadges(item)}
                  onClick={() => {
                    setSelectedItem(item);
                    trackEvent(AnalyticsEvents.menuItemViewed, {
                      itemId: item.id,
                      itemName: item.name,
                      source: 'menu_card'
                    });
                  }}
                  onQuickAdd={() => addBaseItemToCart(item)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {selectedItem && (
        <MenuItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <style jsx>{`
        .menu-grid-section {
          padding-top: 2rem;
          padding-bottom: 4rem;
        }

        .menu-search-shell {
          padding-top: 0.4rem;
          display: grid;
          gap: 0.4rem;
        }

        .menu-search-label {
          color: var(--warm-gray);
          font-size: 0.9rem;
        }

        .menu-search-input {
          border: 1px solid var(--line);
          border-radius: 0.6rem;
          background: rgba(16, 32, 41, 0.7);
          color: var(--cream);
          min-height: 2.75rem;
          padding: 0.65rem 0.8rem;
          width: min(720px, 100%);
        }

        .menu-result-count {
          color: var(--warm-gray);
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        .menu-empty-state {
          text-align: center;
          padding: 2rem 1rem;
          display: grid;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }
        
        .category-section {
          margin-bottom: 4rem;
        }
        
        .category-section:last-child {
          margin-bottom: 0;
        }
        
        .category-title {
          font-size: 2rem;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid var(--color-accent, #ff6b35);
        }
        
        .menu-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 2rem;
        }
        
        @media (max-width: 768px) {
          .menu-grid {
            grid-template-columns: 1fr;
          }
          
          .category-title {
            font-size: 1.5rem;
          }

          .menu-search-shell {
            padding-top: 0;
          }
        }
      `}</style>
    </>
  );
}
