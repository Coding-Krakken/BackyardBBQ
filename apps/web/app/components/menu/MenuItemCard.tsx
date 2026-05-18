'use client';

import Image from 'next/image';

interface MenuItemCardProps {
  item: {
    id: string;
    name: string;
    description: string | null;
    basePriceCents: number;
    imageUrl: string | null;
  };
  badges: string[];
  onClick: () => void;
  onQuickAdd: () => void;
}

export function MenuItemCard({ item, badges, onClick, onQuickAdd }: MenuItemCardProps) {
  const fallbackImage = '/images/marketing/menu-brisket.jpg';
  
  return (
    <article 
      className="menu-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="menu-card-image">
        <Image
          src={item.imageUrl || fallbackImage}
          alt={item.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          style={{ objectFit: 'cover' }}
        />
      </div>
      <div className="menu-card-content">
        <h3 className="menu-card-title">{item.name}</h3>
        {badges.length > 0 ? (
          <div className="menu-card-badges" aria-label="Item badges">
            {badges.slice(0, 2).map((badge) => (
              <span key={badge} className="menu-badge">
                {badge}
              </span>
            ))}
          </div>
        ) : null}
        {item.description && (
          <p className="menu-card-description">{item.description}</p>
        )}
        <div className="menu-card-footer">
          <span className="menu-card-price">${(item.basePriceCents / 100).toFixed(2)}</span>
          <div className="menu-card-actions">
            <button
              type="button"
              className="menu-card-add"
              onClick={(event) => {
                event.stopPropagation();
                onQuickAdd();
              }}
            >
              Add to Cart
            </button>
            <span className="menu-card-cta">View Details</span>
          </div>
        </div>
      </div>
      <style jsx>{`
        .menu-card {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .menu-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        
        .menu-card-image {
          position: relative;
          width: 100%;
          padding-top: 66.67%;
          background: #222;
        }
        
        .menu-card-content {
          padding: 1.5rem;
        }

        .menu-card-badges {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .menu-badge {
          font-size: 0.7rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 999px;
          padding: 0.2rem 0.55rem;
          color: rgba(255, 255, 255, 0.84);
          background: rgba(15, 26, 31, 0.78);
        }
        
        .menu-card-title {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
        }
        
        .menu-card-description {
          margin: 0 0 1rem 0;
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .menu-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.8rem;
        }
        
        .menu-card-price {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-accent, #ff6b35);
        }
        
        .menu-card-actions {
          display: flex;
          align-items: center;
          gap: 0.55rem;
        }

        .menu-card-add {
          border: 1px solid rgba(217, 109, 49, 0.65);
          background: rgba(217, 109, 49, 0.15);
          color: var(--cream);
          border-radius: 999px;
          padding: 0.35rem 0.7rem;
          font-size: 0.75rem;
          cursor: pointer;
        }

        .menu-card-add:hover {
          background: rgba(217, 109, 49, 0.3);
        }

        .menu-card-cta {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
          transition: color 0.2s;
        }
        
        .menu-card:hover .menu-card-cta {
          color: var(--color-accent, #ff6b35);
        }
      `}</style>
    </article>
  );
}
