'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useCart, CartCustomization } from '../cart/CartContext';

interface Customization {
  name: string;
  priceCents: number;
}

interface MenuItemModalProps {
  item: {
    id: string;
    name: string;
    description: string | null;
    basePriceCents: number;
    imageUrl: string | null;
    customizations: unknown;
  };
  onClose: () => void;
}

export function MenuItemModal({ item, onClose }: MenuItemModalProps) {
  const { dispatch } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedCustomizations, setSelectedCustomizations] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');

  const customizations: Customization[] = Array.isArray(item.customizations) 
    ? item.customizations as Customization[] 
    : [];

  const toggleCustomization = (index: number) => {
    const newSet = new Set(selectedCustomizations);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedCustomizations(newSet);
  };

  const customizationTotal = Array.from(selectedCustomizations).reduce(
    (sum, idx) => sum + (customizations[idx]?.priceCents || 0),
    0
  );

  const totalPrice = (item.basePriceCents + customizationTotal) * quantity;

  const handleAddToCart = () => {
    const selectedCustomizationsList: CartCustomization[] = Array.from(selectedCustomizations)
      .map(idx => customizations[idx])
      .filter((c): c is CartCustomization => c !== undefined);

    dispatch({
      type: 'ADD_ITEM',
      payload: {
        menuItemId: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        unitPriceCents: item.basePriceCents,
        quantity,
        customizations: selectedCustomizationsList,
        notes
      }
    });
    onClose();
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const fallbackImage = '/images/marketing/menu-brisket.jpg';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="modal-image">
          <Image
            src={item.imageUrl || fallbackImage}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>

        <div className="modal-details">
          <h2 className="modal-title">{item.name}</h2>
          {item.description && (
            <p className="modal-description">{item.description}</p>
          )}
          <div className="modal-price-base">
            Base Price: ${(item.basePriceCents / 100).toFixed(2)}
          </div>

          {customizations.length > 0 && (
            <div className="customizations-section">
              <h3>Customizations</h3>
              <div className="customizations-list">
                {customizations.map((custom, idx) => (
                  <label key={idx} className="customization-item">
                    <input
                      type="checkbox"
                      checked={selectedCustomizations.has(idx)}
                      onChange={() => toggleCustomization(idx)}
                    />
                    <span>{custom.name}</span>
                    <span className="custom-price">+${(custom.priceCents / 100).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="notes-section">
            <label htmlFor="notes">Special Instructions</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests? (optional)"
              rows={3}
            />
          </div>

          <div className="quantity-section">
            <label>Quantity</label>
            <div className="quantity-controls">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span>{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-primary btn-full" onClick={handleAddToCart}>
              Add to Cart — ${(totalPrice / 100).toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          overflow-y: auto;
        }
        
        .modal-content {
          background: var(--color-bg-secondary, #1a1a1a);
          border-radius: 12px;
          max-width: 900px;
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          overflow: hidden;
          position: relative;
          max-height: 90vh;
        }
        
        .modal-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(0, 0, 0, 0.7);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 32px;
          cursor: pointer;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        
        .modal-close:hover {
          background: rgba(255, 0, 0, 0.7);
        }
        
        .modal-image {
          position: relative;
          min-height: 400px;
          background: #222;
        }
        
        .modal-details {
          padding: 2rem;
          overflow-y: auto;
        }
        
        .modal-title {
          margin: 0 0 1rem 0;
          font-size: 2rem;
        }
        
        .modal-description {
          margin: 0 0 1.5rem 0;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.6;
        }
        
        .modal-price-base {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-accent, #ff6b35);
          margin-bottom: 1.5rem;
        }
        
        .customizations-section {
          margin-bottom: 1.5rem;
        }
        
        .customizations-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
        }
        
        .customizations-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .customization-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          cursor: pointer;
        }
        
        .customization-item input {
          cursor: pointer;
        }
        
        .customization-item span:first-of-type {
          flex: 1;
        }
        
        .custom-price {
          color: rgba(255, 255, 255, 0.7);
          font-weight: 600;
        }
        
        .notes-section {
          margin-bottom: 1.5rem;
        }
        
        .notes-section label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .notes-section textarea {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: white;
          font-family: inherit;
          resize: vertical;
        }
        
        .quantity-section {
          margin-bottom: 1.5rem;
        }
        
        .quantity-section label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .quantity-controls {
          display: inline-flex;
          align-items: center;
          gap: 1rem;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.5rem 1rem;
          border-radius: 8px;
        }
        
        .quantity-controls button {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 4px;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .quantity-controls button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .quantity-controls span {
          min-width: 40px;
          text-align: center;
          font-weight: 700;
          font-size: 1.1rem;
        }
        
        .modal-footer {
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .btn-full {
          width: 100%;
        }
        
        @media (max-width: 768px) {
          .modal-content {
            grid-template-columns: 1fr;
          }
          
          .modal-image {
            min-height: 250px;
          }
          
          .modal-details {
            padding: 1.5rem;
          }
          
          .modal-title {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
