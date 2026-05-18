"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./cart/CartContext";
import { AnalyticsEvents, trackEvent } from "../lib/analytics";

export function MobileCartCTA() {
  const pathname = usePathname();
  const { itemCount, estimatedTotalCents } = useCart();

  if (itemCount === 0) {
    return null;
  }

  const hiddenRoutes = ["/cart", "/checkout", "/checkout/success"];
  if (hiddenRoutes.some((route) => pathname?.startsWith(route))) {
    return null;
  }

  return (
    <Link
      href="/cart"
      className="mobile-cart-cta"
      aria-label={`Open cart with ${itemCount} items`}
      onClick={() =>
        trackEvent(AnalyticsEvents.cartOpened, {
          source: "mobile_cart_cta",
          itemCount,
          estimatedTotalCents
        })
      }
    >
      <span className="mobile-cart-cta-label">View Cart</span>
      <span className="mobile-cart-cta-meta">
        {itemCount} items • ${(estimatedTotalCents / 100).toFixed(2)}
      </span>

      <style jsx>{`
        .mobile-cart-cta {
          position: fixed;
          right: 0.8rem;
          left: 0.8rem;
          bottom: calc(4.4rem + env(safe-area-inset-bottom));
          z-index: 54;
          display: none;
          gap: 0.15rem;
          align-items: center;
          justify-content: space-between;
          border-radius: 0.85rem;
          border: 1px solid rgba(217, 109, 49, 0.35);
          padding: 0.7rem 0.85rem;
          background: linear-gradient(120deg, rgba(217, 109, 49, 0.95), rgba(231, 125, 58, 0.98));
          color: #1a0f08;
          font-weight: 700;
          box-shadow: 0 12px 28px rgba(8, 4, 2, 0.35);
        }

        .mobile-cart-cta-label {
          font-size: 0.95rem;
          line-height: 1.1;
        }

        .mobile-cart-cta-meta {
          font-size: 0.82rem;
          line-height: 1.1;
        }

        @media (max-width: 768px) {
          .mobile-cart-cta {
            display: flex;
          }
        }
      `}</style>
    </Link>
  );
}
