'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCart } from '../components/cart/CartContext';
import { CartItem } from '../components/cart/CartItem';
import { SiteNavbar } from '../components/SiteNavbar';
import { SiteFooter } from '../components/HomeSections';

export default function CartPage() {
  const router = useRouter();
  const { state, dispatch, subtotalCents, estimatedTaxCents, estimatedTotalCents } = useCart();

  useEffect(() => {
    // Redirect if cart is empty
    if (state.items.length === 0) {
      const timer = setTimeout(() => {
        router.push('/menu');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.items.length, router]);

  return (
    <main id="main-content">
      <SiteNavbar />
      
      <section className="page-shell section cart-page">
        <h1 className="page-title">Your Cart</h1>
        
        {state.items.length === 0 ? (
          <div className="panel cart-empty-state">
            <h2>Your cart is empty</h2>
            <p>Redirecting to menu...</p>
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
                <div className="summary-row summary-total">
                  <span>Estimated Total</span>
                  <span>${(estimatedTotalCents / 100).toFixed(2)}</span>
                </div>
              </div>
              
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
