'use client';

import Link from 'next/link';
import { useCart } from './CartContext';
import { CartItem as CartItemComponent } from './CartItem';
import { useEffect } from 'react';
import { AnalyticsEvents, trackEvent } from '../../lib/analytics';

export function CartDrawer() {
  const { state, dispatch, subtotalCents, estimatedTaxCents, estimatedTotalCents } = useCart();

  // Close cart on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isOpen) {
        dispatch({ type: 'CLOSE_CART' });
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [state.isOpen, dispatch]);

  // Prevent body scroll when cart is open
  useEffect(() => {
    if (state.isOpen) {
      document.body.style.overflow = 'hidden';
      trackEvent(AnalyticsEvents.cartOpened, { source: 'cart_drawer' });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [state.isOpen]);

  if (!state.isOpen) return null;

  return (
    <>
      <div className="cart-drawer-backdrop" onClick={() => dispatch({ type: 'CLOSE_CART' })} />
      <div className="cart-drawer">
        <div className="cart-drawer-header">
          <h2>Your Cart</h2>
          <button
            onClick={() => dispatch({ type: 'CLOSE_CART' })}
            className="cart-drawer-close"
            aria-label="Close cart"
          >
            ×
          </button>
        </div>

        <div className="cart-drawer-items">
          {state.items.length === 0 ? (
            <div className="cart-empty">
              <p>Your cart is empty</p>
              <Link href="/menu" className="btn btn-primary" onClick={() => dispatch({ type: 'CLOSE_CART' })}>
                Browse Menu
              </Link>
            </div>
          ) : (
            state.items.map(item => (
              <CartItemComponent key={item.menuItemId} item={item} />
            ))
          )}
        </div>

        {state.items.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-summary">
              <div className="cart-summary-row">
                <span>Subtotal</span>
                <span>${(subtotalCents / 100).toFixed(2)}</span>
              </div>
              <div className="cart-summary-row">
                <span>Est. Tax</span>
                <span>${(estimatedTaxCents / 100).toFixed(2)}</span>
              </div>
              <div className="cart-summary-row cart-total">
                <span>Estimated Total</span>
                <span>${(estimatedTotalCents / 100).toFixed(2)}</span>
              </div>
            </div>
            <div className="cart-actions">
              <Link
                href="/cart"
                className="btn btn-secondary"
                onClick={() => dispatch({ type: 'CLOSE_CART' })}
              >
                View Cart
              </Link>
              <Link
                href="/checkout"
                className="btn btn-primary"
                onClick={() => dispatch({ type: 'CLOSE_CART' })}
              >
                Checkout
              </Link>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .cart-drawer-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 998;
          animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .cart-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 450px;
          background: var(--color-bg-secondary, #1a1a1a);
          z-index: 999;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        
        .cart-drawer-header {
          padding: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .cart-drawer-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }
        
        .cart-drawer-close {
          background: none;
          border: none;
          color: white;
          font-size: 36px;
          cursor: pointer;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
          line-height: 1;
        }
        
        .cart-drawer-close:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .cart-drawer-items {
          flex: 1;
          overflow-y: auto;
        }
        
        .cart-empty {
          padding: 3rem 1.5rem;
          text-align: center;
        }
        
        .cart-empty p {
          margin: 0 0 1.5rem 0;
          color: rgba(255, 255, 255, 0.6);
        }
        
        .cart-drawer-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1.5rem;
        }
        
        .cart-summary {
          margin-bottom: 1.5rem;
        }
        
        .cart-summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.75rem;
          font-size: 0.95rem;
        }
        
        .cart-total {
          font-size: 1.1rem;
          font-weight: 700;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .cart-actions {
          display: flex;
          gap: 1rem;
        }
        
        .cart-actions .btn {
          flex: 1;
        }
        
        @media (max-width: 500px) {
          .cart-drawer {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  );
}
