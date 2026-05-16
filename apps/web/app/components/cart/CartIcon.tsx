'use client';

import { useCart } from './CartContext';

export function CartIcon() {
  const { itemCount, dispatch } = useCart();

  return (
    <button
      onClick={() => dispatch({ type: 'TOGGLE_CART' })}
      className="cart-icon-button"
      aria-label={`Shopping cart with ${itemCount} items`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {itemCount > 0 && (
        <span className="cart-badge">{itemCount}</span>
      )}
      <style jsx>{`
        .cart-icon-button {
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          color: var(--color-text);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
        }
        
        .cart-icon-button:hover {
          opacity: 0.7;
        }
        
        .cart-badge {
          position: absolute;
          top: 0;
          right: 0;
          background: var(--color-accent, #ff6b35);
          color: white;
          font-size: 10px;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }
      `}</style>
    </button>
  );
}
