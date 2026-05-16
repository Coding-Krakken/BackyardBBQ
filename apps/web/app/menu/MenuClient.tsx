'use client';

import { useState } from 'react';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { MenuItemModal } from '../components/menu/MenuItemModal';
import { CategoryNav } from '../components/menu/CategoryNav';

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
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredCategories = activeCategory === 'all'
    ? itemsByCategory
    : itemsByCategory.filter(cat => cat.category === activeCategory);

  return (
    <>
      <CategoryNav
        categories={itemsByCategory.map(c => ({ value: c.category, label: c.label }))}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      
      <section className="page-shell section menu-grid-section">
        {filteredCategories.map(categoryGroup => (
          <div key={categoryGroup.category} id={categoryGroup.category} className="category-section">
            <h2 className="category-title">{categoryGroup.label}</h2>
            <div className="menu-grid">
              {categoryGroup.items.map(item => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelectedItem(item)}
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
        }
      `}</style>
    </>
  );
}
