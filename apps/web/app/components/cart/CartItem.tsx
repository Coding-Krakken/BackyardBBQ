'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CartItem as CartItemType, useCart } from './CartContext';

interface CartItemProps {
  item: CartItemType;
  showControls?: boolean;
}

export function CartItem({ item, showControls = true }: CartItemProps) {
  const { dispatch } = useCart();
  const fallbackImage = '/images/marketing/menu-brisket.jpg';
  const [imageSrc, setImageSrc] = useState(item.imageUrl || fallbackImage);

  useEffect(() => {
    setImageSrc(item.imageUrl || fallbackImage);
  }, [item.imageUrl]);

  const useDirectImageUrl = /^https?:\/\//.test(imageSrc);

  const customizationTotal = item.customizations.reduce((sum, c) => sum + c.priceCents, 0);
  const itemTotal = (item.unitPriceCents + customizationTotal) * item.quantity;

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity <= 0) {
      dispatch({ type: 'REMOVE_ITEM', payload: { menuItemId: item.menuItemId } });
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { menuItemId: item.menuItemId, quantity: newQuantity } });
    }
  };

  return (
    <div className="cart-item">
      {imageSrc && (
        <div className="cart-item-image">
          <Image
            src={imageSrc}
            alt={item.name}
            width={80}
            height={80}
            unoptimized={useDirectImageUrl}
            onError={() => setImageSrc(fallbackImage)}
            style={{ objectFit: 'cover', borderRadius: '4px' }}
          />
        </div>
      )}
      <div className="cart-item-details">
        <h4 className="cart-item-name">{item.name}</h4>
        {item.customizations.length > 0 && (
          <ul className="cart-item-customizations">
            {item.customizations.map((custom, idx) => (
              <li key={idx}>
                {custom.name} (+${(custom.priceCents / 100).toFixed(2)})
              </li>
            ))}
          </ul>
        )}
        {item.notes && (
          <p className="cart-item-notes">Note: {item.notes}</p>
        )}
        <div className="cart-item-footer">
          {showControls && (
            <div className="quantity-controls">
              <button
                onClick={() => handleQuantityChange(item.quantity - 1)}
                className="quantity-btn"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="quantity-display">{item.quantity}</span>
              <button
                onClick={() => handleQuantityChange(item.quantity + 1)}
                className="quantity-btn"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          )}
          {!showControls && <span>Qty: {item.quantity}</span>}
          <span className="cart-item-price">${(itemTotal / 100).toFixed(2)}</span>
        </div>
      </div>
      {showControls && (
        <button
          onClick={() => dispatch({ type: 'REMOVE_ITEM', payload: { menuItemId: item.menuItemId } })}
          className="cart-item-remove"
          aria-label="Remove item"
        >
          ×
        </button>
      )}
      <style jsx>{`
        .cart-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          position: relative;
        }
        
        .cart-item-image {
          flex-shrink: 0;
        }
        
        .cart-item-details {
          flex: 1;
          min-width: 0;
        }
        
        .cart-item-name {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 600;
        }
        
        .cart-item-customizations {
          list-style: none;
          padding: 0;
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.7);
        }
        
        .cart-item-notes {
          font-size: 0.875rem;
          font-style: italic;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 0.5rem 0;
        }
        
        .cart-item-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .quantity-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          padding: 0.25rem;
        }
        
        .quantity-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        
        .quantity-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .quantity-display {
          min-width: 30px;
          text-align: center;
          font-weight: 600;
        }
        
        .cart-item-price {
          font-weight: 700;
          font-size: 1.1rem;
        }
        
        .cart-item-remove {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 24px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        
        .cart-item-remove:hover {
          background: rgba(255, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
