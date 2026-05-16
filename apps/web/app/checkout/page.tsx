"use client";

export const dynamic = 'force-dynamic';

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckoutElementsProvider, 
  PaymentElement,
  ExpressCheckoutElement,
  useCheckout 
} from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import { SiteFooter } from "../components/HomeSections";
import { SiteNavbar } from "../components/SiteNavbar";
import { useCart } from "../components/cart/CartContext";
import { businessInfo } from "../config/content";
import { siteImages } from "../config/images";
import type { CartItem } from "../components/cart/CartContext";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function CheckoutForm() {
  const checkoutState = useCheckout();
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (checkoutState.type !== "success") {
      return;
    }

    const { checkout } = checkoutState;

    setSubmitting(true);
    setStatus("");

    try {
      const confirmResult = await checkout.confirm();
      if (confirmResult.type === "error") {
        setStatus(confirmResult.error.message ?? "Payment failed. Please try again.");
      }
      // On success, user will be redirected to return_url
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="checkout-form">
      {/* Express Checkout for one-click payments */}
      <div style={{ marginBottom: "1.5rem" }}>
        <ExpressCheckoutElement onConfirm={() => undefined} />
      </div>

      <div style={{ 
        textAlign: "center", 
        margin: "1.5rem 0",
        position: "relative"
      }}>
        <span style={{
          background: "var(--bg-dark)",
          padding: "0 1rem",
          position: "relative",
          zIndex: 1,
          color: "var(--warm-gray)"
        }}>
          Or pay with card
        </span>
        <div style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: "1px",
          background: "var(--line)",
          zIndex: 0
        }} />
      </div>

      {/* Payment Element with accordion layout */}
      <PaymentElement 
        options={{
          layout: {
            type: "accordion",
            defaultCollapsed: false,
            radios: "auto",
            spacedAccordionItems: true
          }
        }}
      />
      
      <button 
        className="btn btn-primary" 
        style={{ marginTop: "1.5rem", width: "100%" }} 
        type="submit" 
        disabled={submitting}
      >
        {submitting ? "Processing..." : "Pay Securely"}
      </button>
      {status ? <p className="status-text" style={{ marginTop: "1rem", color: "var(--ember)" }}>{status}</p> : null}
    </form>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { state, isHydrated, subtotalCents, estimatedTaxCents } = useCart();
  const items = state.items;
  const idempotencyKeyRef = useRef(`checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (!stripePromise) {
      return "Secure checkout is unavailable because Stripe is not configured in this environment.";
    }

    return null;
  });
  const initializedRef = useRef(false);

  // Redirect if cart is empty
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (items.length === 0) {
      router.push('/menu');
    }
  }, [isHydrated, items.length, router]);

  useEffect(() => {
    if (!isHydrated || initializedRef.current || items.length === 0) {
      return;
    }
    initializedRef.current = true;

    if (!stripePromise) {
      setErrorMessage("Secure checkout is unavailable because Stripe is not configured in this environment.");
      return;
    }

    const createCheckoutSession = async () => {
      try {
        const response = await fetch('/api/payments/create-checkout-session', {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amountCents: subtotalCents,
            currency: "usd",
            metadata: {
              checkoutContext: "direct-web-order",
              itemCount: items.length,
              subtotalCents,
              clientTaxCents: estimatedTaxCents,
              idempotencyKey: idempotencyKeyRef.current,
              timestamp: new Date().toISOString()
            }
          })
        });

        if (!response.ok) {
          throw new Error("Unable to initialize checkout.");
        }

        const payload = (await response.json()) as { clientSecret: string; sessionId: string };
        setClientSecret(payload.clientSecret);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to initialize checkout.");
      }
    };

    createCheckoutSession().catch(() => {
      setErrorMessage("Unable to initialize checkout.");
    });
  }, [isHydrated, items, subtotalCents, estimatedTaxCents]);

  const checkoutOptions = useMemo(
    () =>
      clientSecret
        ? { clientSecret }
        : undefined,
    [clientSecret]
  );

  return (
    <main id="main-content">
      <SiteNavbar />

      <section className="subpage-hero reveal">
        <Image src={siteImages.hero.src} alt={siteImages.hero.alt} fill priority sizes="100vw" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="page-shell subpage-hero-content narrow">
          <span className="hero-eyebrow">Secure Payment</span>
          <h1>Fast, Protected Checkout for Premium BBQ Orders</h1>
          <p>
            Your payment is processed by Stripe with modern encryption and a trusted card-entry experience designed
            for speed on mobile and desktop.
          </p>
        </div>
      </section>

      <section className="page-shell section checkout-grid reveal">
        <article className="panel checkout-panel">
          <span className="eyebrow">Checkout</span>
          <h2>Secure Checkout</h2>
          <p>Powered by Stripe with Link for faster checkout, Express payment options, and secure card processing.</p>
          {errorMessage ? <p className="status-text">{errorMessage}</p> : null}
          {checkoutOptions && stripePromise ? (
            <CheckoutElementsProvider stripe={stripePromise} options={checkoutOptions}>
              <CheckoutForm />
            </CheckoutElementsProvider>
          ) : !errorMessage ? (
            <p className="status-text">Preparing secure payment...</p>
          ) : null}
        </article>

        <article className="panel checkout-summary">
          <span className="eyebrow">Order Summary</span>
          <h3>Your Order</h3>
          <div style={{ marginBottom: '1.5rem' }}>
            {items.map((item: CartItem, index: number) => (
              <div key={`${item.menuItemId}-${index}`} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '0.5rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--line)'
              }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{item.name} × {item.quantity}</div>
                  {item.customizations && item.customizations.length > 0 && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--warm-gray)', marginTop: '0.25rem' }}>
                      {item.customizations.map((c) => c.name).join(', ')}
                    </div>
                  )}
                  {item.notes && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--warm-gray)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                      Note: {item.notes}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                  ${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ 
            borderTop: '2px solid var(--ember)', 
            paddingTop: '1rem',
            marginTop: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Subtotal:</span>
              <span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--warm-gray)' }}>
              <span>Tax:</span>
              <span>Calculated securely at checkout</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--line)',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: 'var(--ember)'
            }}>
              <span>Subtotal Before Tax:</span>
              <span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>
          </div>
          <div className="booking-contact" style={{ marginTop: '2rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--warm-gray)' }}>
              Questions? Contact us:
            </p>
            <p>{businessInfo.phone}</p>
            <p>{businessInfo.email}</p>
          </div>
          <div className="cta-row">
            <Link className="btn btn-secondary" href="/cart">
              Edit Cart
            </Link>
            <Link className="btn btn-secondary" href="/menu">
              Keep Shopping
            </Link>
          </div>
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}
