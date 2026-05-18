"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./cart/CartContext";
import { AnalyticsEvents, trackEvent } from "../lib/analytics";

export function MobileBottomBar() {
  const pathname = usePathname();
  const { itemCount, estimatedTotalCents, dispatch } = useCart();

  const hiddenOnRoutes = ["/checkout", "/checkout/success"];
  if (hiddenOnRoutes.some((route) => pathname?.startsWith(route))) {
    return null;
  }

  return (
    <nav className="mobile-bottom-bar" aria-label="Mobile quick actions">
      <Link
        href="/menu"
        className="mobile-bottom-link"
        onClick={() => trackEvent(AnalyticsEvents.ctaClickedOrderOnline, { source: "mobile_bottom_bar" })}
      >
        <span>Order</span>
      </Link>
      <Link
        href="/catering"
        className="mobile-bottom-link"
        onClick={() => trackEvent(AnalyticsEvents.ctaClickedBookCatering, { source: "mobile_bottom_bar" })}
      >
        <span>Catering</span>
      </Link>
      <Link
        href="/reserve"
        className="mobile-bottom-link"
        onClick={() => trackEvent(AnalyticsEvents.ctaClickedReserveTable, { source: "mobile_bottom_bar" })}
      >
        <span>Reserve</span>
      </Link>
      <button
        type="button"
        className="mobile-bottom-link mobile-bottom-cart"
        onClick={() => dispatch({ type: "OPEN_CART" })}
      >
        <span>Cart</span>
        {itemCount > 0 ? <small>{itemCount} • ${(estimatedTotalCents / 100).toFixed(2)}</small> : <small>Empty</small>}
      </button>

      <style jsx>{`
        .mobile-bottom-bar {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 55;
          display: none;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.45rem;
          padding: 0.5rem 0.65rem calc(0.5rem + env(safe-area-inset-bottom));
          background: linear-gradient(180deg, rgba(9, 14, 17, 0.94), rgba(6, 8, 9, 0.98));
          border-top: 1px solid rgba(217, 109, 49, 0.28);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .mobile-bottom-link {
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(16, 32, 41, 0.7);
          color: var(--cream);
          border-radius: 0.7rem;
          min-height: 2.85rem;
          display: grid;
          place-items: center;
          text-align: center;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.35rem;
        }

        .mobile-bottom-link small {
          display: block;
          font-size: 0.68rem;
          color: var(--warm-gray);
          margin-top: 0.1rem;
        }

        .mobile-bottom-cart {
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .mobile-bottom-bar {
            display: grid;
          }
        }
      `}</style>
    </nav>
  );
}
