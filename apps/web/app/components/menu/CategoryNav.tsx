'use client';

interface CategoryNavProps {
  categories: Array<{ value: string; label: string }>;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoryNav({ categories, activeCategory, onCategoryChange }: CategoryNavProps) {
  return (
    <nav className="category-nav">
      <div className="page-shell">
        <div className="category-nav-scroll">
          <button
            className={`category-btn ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => onCategoryChange('all')}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat.value}
              className={`category-btn ${activeCategory === cat.value ? 'active' : ''}`}
              onClick={() => onCategoryChange(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
      <style jsx>{`
        .category-nav {
          position: sticky;
          top: 80px;
          z-index: 10;
          background: var(--color-bg, #0a0a0a);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1rem 0;
        }
        
        .category-nav-scroll {
          display: flex;
          gap: 1rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
          scrollbar-width: thin;
        }
        
        .category-btn {
          flex-shrink: 0;
          padding: 0.5rem 1.25rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: white;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        
        .category-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .category-btn.active {
          background: var(--color-accent, #ff6b35);
          border-color: var(--color-accent, #ff6b35);
        }
      `}</style>
    </nav>
  );
}
