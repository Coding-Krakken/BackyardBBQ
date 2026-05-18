'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '../components/cart/CartContext';
import { CartItem } from '../components/cart/CartItem';
import { SiteNavbar } from '../components/SiteNavbar';
import { SiteFooter } from '../components/HomeSections';

export default function CartPage() {
  const { state, dispatch, subtotalCents, estimatedTaxCents } = useCart();
  const [tipPercent, setTipPercent] = useState(15);
  const [customTipCents, setCustomTipCents] = useState<number | null>(null);

  const tipCents = customTipCents ?? Math.round(subtotalCents * (tipPercent / 100));
  const estimatedTotalCents = subtotalCents + estimatedTaxCents + tipCents;

  return (
    <main id="main-content">
      <SiteNavbar />
      
      <section className="page-shell section cart-page">
        <h1 className="page-title">Your Cart</h1>
        
        {state.items.length === 0 ? (
          <div className="panel cart-empty-state">
            <h2>Your cart is empty</h2>
            <p>Start with a smoked brisket plate, fall-off-the-bone ribs, or a family tray.</p>
            <Link href="/menu" className="btn btn-primary">
              Browse Menu
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items-panel panel">
              <h2>Items</h2>
              {state.items.map(item => (
                <CartItem key={item.menuItemId} item={item} showControls={true} />
              ))}
            </div>
            
            <div className="cart-summary-panel panel">
              <h2>Order Summary</h2>
              <div className="summary-rows">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>${(subtotalCents / 100).toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Est. Tax (8%)</span>
                  <span>${(estimatedTaxCents / 100).toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Tip</span>
                  <span>${(tipCents / 100).toFixed(2)}</span>
                </div>
                <div className="summary-row summary-total">
                  <span>Estimated Total</span>
                  <span>${(estimatedTotalCents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="tip-controls" aria-label="Tip options">
                {[0, 15, 18, 20].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    className={tipPercent === percent && customTipCents === null ? 'tip-btn active' : 'tip-btn'}
                    onClick={() => {
                      setTipPercent(percent);
                      setCustomTipCents(null);
                    }}
                  >
                    {percent}%
                  </button>
                ))}
                <button
                  type="button"
                  className={customTipCents !== null ? 'tip-btn active' : 'tip-btn'}
                  onClick={() => {
                    setTipPercent(0);
                    setCustomTipCents(Math.round(subtotalCents * 0.2));
                  }}
                >
                  Custom
                </button>
              </div>

              {customTipCents !== null ? (
                <label className="custom-tip-label">
                  Custom Tip (USD)
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={(customTipCents / 100).toFixed(2)}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setCustomTipCents(Number.isFinite(next) ? Math.max(0, Math.round(next * 100)) : 0);
                    }}
                  />
                </label>
              ) : null}
              
              <div className="summary-actions">
                <Link href="/checkout" className="btn btn-primary btn-full">
                  Proceed to Checkout
                </Link>
                <Link href="/menu" className="btn btn-secondary btn-full">
                  Continue Shopping
                </Link>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear your cart?')) {
                      dispatch({ type: 'CLEAR_CART' });
                    }
                  }}
                  className="btn btn-ghost btn-full"
                >
                  Clear Cart
                </button>
              </div>
              
              <div className="summary-note">
                <p>
                  <small>
                    Final tax will be calculated at checkout. Prices and availability subject to change.
                  </small>
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
      
      <SiteFooter />
      
      <style jsx>{`
        .cart-page {
          min-height: 60vh;
          padding-top: 2rem;
          padding-bottom: 4rem;
        }
        
        .page-title {
          margin-bottom: 2rem;
          font-size: 2.5rem;
        }
        
        .cart-empty-state {
          text-align: center;
          padding: 4rem 2rem;
        }
        
        .cart-empty-state h2 {
          margin-bottom: 1rem;
        }
        
        .cart-empty-state p {
          margin-bottom: 2rem;
          color: rgba(255, 255, 255, 0.6);
        }
        
        .cart-layout {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 2rem;
          align-items: start;
        }
        
        .cart-items-panel h2 {
          margin: 0 0 1rem 0;
          padding: 0 1rem;
        }
        
        .cart-summary-panel {
          position: sticky;
          top: 100px;
        }
        
        .cart-summary-panel h2 {
          margin: 0 0 1.5rem 0;
        }
        
        .summary-rows {
          margin-bottom: 1.5rem;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.75rem;
          font-size: 1rem;
        }
        
        .summary-total {
          font-size: 1.25rem;
          font-weight: 700;
          padding-top: 1rem;
          margin-top: 1rem;
          border-top: 2px solid rgba(255, 255, 255, 0.2);
        }
        
        .summary-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .tip-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .tip-btn {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(16, 32, 41, 0.75);
          color: var(--cream);
          border-radius: 999px;
          min-height: 2.2rem;
          padding: 0.35rem 0.65rem;
          cursor: pointer;
        }

        .tip-btn.active {
          border-color: rgba(217, 109, 49, 0.65);
          background: rgba(217, 109, 49, 0.22);
        }

        .custom-tip-label {
          display: grid;
          gap: 0.35rem;
          margin-bottom: 1rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.9rem;
        }

        .custom-tip-label input {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          min-height: 2.4rem;
          padding: 0.5rem 0.65rem;
          background: rgba(16, 32, 41, 0.8);
          color: var(--cream);
        }
        
        .btn-full {
          width: 100%;
        }
        
        .summary-note {
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          text-align: center;
        }
        
        .summary-note small {
          font-size: 0.875rem;
        }
        
        @media (max-width: 900px) {
          .cart-layout {
            grid-template-columns: 1fr;
          }
          
          .cart-summary-panel {
            position: static;
          }
        }
      `}</style>
    </main>
  );
}
