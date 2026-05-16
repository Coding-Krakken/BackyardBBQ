"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { SiteFooter } from "../components/HomeSections";
import { SiteNavbar } from "../components/SiteNavbar";
import { useCart } from "../components/cart/CartContext";
import { businessInfo } from "../config/content";
import { siteImages } from "../config/images";
import { TAX_RATE } from "../config/constants";
import type { CartItem } from "../components/cart/CartContext";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);
    setStatus("");

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required"
    });

    if (result.error) {
      setStatus(result.error.message ?? "Payment failed. Please try again.");
    } else if (result.paymentIntent) {
      setStatus(`Payment status: ${result.paymentIntent.status}`);
    }

    setSubmitting(false);
  };

  return (
    <form onSubmit={onSubmit} className="checkout-form">
      <PaymentElement />
      <button className="btn btn-primary" style={{ marginTop: "1rem" }} type="submit" disabled={submitting}>
        {submitting ? "Processing..." : "Pay Securely"}
      </button>
      {status ? <p className="status-text">{status}</p> : null}
    </form>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { state, dispatch, subtotalCents, estimatedTaxCents, estimatedTotalCents } = useCart();
  const items = state.items;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (!stripePromise) {
      return "Secure checkout is unavailable because Stripe is not configured in this environment.";
    }

    if (!apiBaseUrl) {
      return "Secure checkout is unavailable because API base URL is not configured in this environment.";
    }

    return null;
  });
  const initializedRef = useRef(false);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      router.push('/menu');
    }
  }, [items.length, router]);

  useEffect(() => {
    if (initializedRef.current || items.length === 0) {
      return;
    }
    initializedRef.current = true;

    if (!stripePromise) {
      setErrorMessage("Secure checkout is unavailable because Stripe is not configured in this environment.");
      return;
    }

    if (!apiBaseUrl) {
      setErrorMessage("Secure checkout is unavailable because API base URL is not configured in this environment.");
      return;
    }

    const createIntent = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/payments/create-intent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amountCents: estimatedTotalCents,
            currency: "usd",
            metadata: {
              checkoutContext: "direct-web-order",
              itemCount: items.length,
              subtotalCents,
              taxCents: estimatedTaxCents,
              taxRate: TAX_RATE
            }
          })
        });

        if (!response.ok) {
          throw new Error("Unable to initialize payment.");
        }

        const payload = (await response.json()) as { clientSecret: string };
        setClientSecret(payload.clientSecret);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to initialize payment.");
      }
    };

    createIntent().catch(() => {
      setErrorMessage("Unable to initialize payment.");
    });
  }, [items, estimatedTotalCents, subtotalCents, estimatedTaxCents]);

  const elementOptions = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            appearance: {
              theme: "night" as const,
              labels: "floating" as const
            }
          }
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
          <p>Stripe Payment Element uses a server-created PaymentIntent for secure processing.</p>
          {errorMessage ? <p className="status-text">{errorMessage}</p> : null}
          {elementOptions && stripePromise ? (
            <Elements stripe={stripePromise} options={elementOptions}>
              <CheckoutForm />
            </Elements>
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
              <span>Est. Tax ({(TAX_RATE * 100).toFixed(0)}%):</span>
              <span>${(estimatedTaxCents / 100).toFixed(2)}</span>
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
              <span>Total:</span>
              <span>${(estimatedTotalCents / 100).toFixed(2)}</span>
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
