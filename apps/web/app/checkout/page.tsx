"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckout
} from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import { SiteFooter } from "../components/HomeSections";
import { SiteNavbar } from "../components/SiteNavbar";
import { useCart } from "../components/cart/CartContext";
import { businessInfo } from "../config/content";
import { siteImages } from "../config/images";
import type { CartItem } from "../components/cart/CartContext";
import { AnalyticsEvents, trackEvent } from "../lib/analytics";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type FulfillmentMode = "delivery" | "pickup";
type FulfillmentSpeed = "asap" | "scheduled";

interface CheckoutDetails {
  name: string;
  email: string;
  phone: string;
  fulfillmentMode: FulfillmentMode;
  fulfillmentSpeed: FulfillmentSpeed;
  scheduledFor: string;
  address: string;
  orderNotes: string;
}

const initialCheckoutDetails: CheckoutDetails = {
  name: "",
  email: "",
  phone: "",
  fulfillmentMode: "pickup",
  fulfillmentSpeed: "asap",
  scheduledFor: "",
  address: "",
  orderNotes: ""
};

function validate(details: CheckoutDetails) {
  const errors: Partial<Record<keyof CheckoutDetails, string>> = {};

  if (!details.name.trim()) {
    errors.name = "Please enter your name.";
  }
  if (!details.email.trim() || !details.email.includes("@")) {
    errors.email = "Please enter a valid email.";
  }
  if (!details.phone.trim() || details.phone.trim().length < 7) {
    errors.phone = "Please enter a valid phone number.";
  }
  if (details.fulfillmentSpeed === "scheduled" && !details.scheduledFor) {
    errors.scheduledFor = "Choose a scheduled pickup or delivery time.";
  }
  if (details.fulfillmentMode === "delivery" && !details.address.trim()) {
    errors.address = "Delivery address is required for delivery orders.";
  }

  return errors;
}

function PaymentForm() {
  const checkoutState = useCheckout();
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (checkoutState.type !== "success") {
      return;
    }

    setSubmitting(true);
    setStatus("");

    try {
      const result = await checkoutState.checkout.confirm();
      if (result.type === "error") {
        setStatus(result.error.message ?? "Payment failed. Please try again.");
      } else {
        trackEvent(AnalyticsEvents.checkoutSubmitted, { source: "stripe_elements" });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="checkout-form">
      <div style={{ marginBottom: "1.5rem" }}>
        <ExpressCheckoutElement onConfirm={() => undefined} />
      </div>

      <div style={{ textAlign: "center", margin: "1.5rem 0", position: "relative" }}>
        <span
          style={{
            background: "var(--bg-charcoal)",
            padding: "0 1rem",
            position: "relative",
            zIndex: 1,
            color: "var(--warm-gray)"
          }}
        >
          Or pay with card
        </span>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: "1px",
            background: "var(--line)",
            zIndex: 0
          }}
        />
      </div>

      <PaymentElement
        options={{
          layout: {
            type: "accordion",
            radios: "auto",
            spacedAccordionItems: true
          }
        }}
      />

      <button className="btn btn-primary" style={{ marginTop: "1.5rem", width: "100%" }} type="submit" disabled={submitting}>
        {submitting ? "Processing..." : "Pay Securely"}
      </button>
      {status ? <p className="status-text" style={{ marginTop: "1rem", color: "var(--ember)" }}>{status}</p> : null}
    </form>
  );
}

export default function CheckoutPage() {
  const { state, isHydrated, subtotalCents, estimatedTaxCents } = useCart();
  const items = state.items;

  const [details, setDetails] = useState<CheckoutDetails>(initialCheckoutDetails);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CheckoutDetails, string>>>({});
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [tipPercent, setTipPercent] = useState(15);
  const [customTipCents, setCustomTipCents] = useState<number | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (!stripePromise) {
      return "Secure checkout is unavailable because Stripe is not configured in this environment.";
    }
    return null;
  });

  const idempotencyKeyRef = useRef(`checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const tipCents = customTipCents ?? Math.round(subtotalCents * (tipPercent / 100));
  const totalBeforePaymentCents = subtotalCents + estimatedTaxCents + tipCents;

  useEffect(() => {
    if (!checkoutStarted || !isHydrated || items.length === 0 || clientSecret) {
      return;
    }

    if (!stripePromise) {
      setErrorMessage("Secure checkout is unavailable because Stripe is not configured in this environment.");
      return;
    }

    const createSession = async () => {
      try {
        const response = await fetch("/api/payments/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amountCents: subtotalCents + tipCents,
            currency: "usd",
            metadata: {
              checkoutContext: "direct-web-order",
              itemCount: items.length,
              fulfillmentMode: details.fulfillmentMode,
              fulfillmentSpeed: details.fulfillmentSpeed,
              scheduledFor: details.fulfillmentSpeed === "scheduled" ? details.scheduledFor : "",
              customerName: details.name,
              customerEmail: details.email,
              customerPhone: details.phone,
              deliveryAddress: details.fulfillmentMode === "delivery" ? details.address : "",
              orderNotes: details.orderNotes,
              subtotalCents,
              tipCents,
              clientTaxCents: estimatedTaxCents,
              idempotencyKey: idempotencyKeyRef.current,
              timestamp: new Date().toISOString()
            }
          })
        });

        if (!response.ok) {
          throw new Error("Unable to initialize checkout.");
        }

        const payload = (await response.json()) as { clientSecret: string };
        setClientSecret(payload.clientSecret);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to initialize checkout.");
      }
    };

    createSession().catch(() => {
      setErrorMessage("Unable to initialize checkout.");
    });
  }, [
    checkoutStarted,
    clientSecret,
    details.address,
    details.email,
    details.fulfillmentMode,
    details.fulfillmentSpeed,
    details.name,
    details.orderNotes,
    details.phone,
    details.scheduledFor,
    estimatedTaxCents,
    isHydrated,
    items.length,
    subtotalCents,
    tipCents
  ]);

  const checkoutOptions = useMemo(() => (clientSecret ? { clientSecret } : undefined), [clientSecret]);

  const setField = <K extends keyof CheckoutDetails>(key: K, value: CheckoutDetails[K]) => {
    setDetails((previous) => ({ ...previous, [key]: value }));
    setFormErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const startCheckout = () => {
    const errors = validate(details);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    trackEvent(AnalyticsEvents.checkoutStarted, {
      itemCount: items.length,
      fulfillmentMode: details.fulfillmentMode,
      fulfillmentSpeed: details.fulfillmentSpeed,
      subtotalCents,
      tipCents
    });

    setCheckoutStarted(true);
  };

  return (
    <main id="main-content">
      <SiteNavbar />

      <section className="subpage-hero reveal">
        <Image src={siteImages.hero.src} alt={siteImages.hero.alt} fill priority sizes="100vw" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="page-shell subpage-hero-content narrow">
          <span className="hero-eyebrow">Secure Payment</span>
          <h1>Checkout</h1>
          <p>Complete your order details first, then finish payment with a secure Stripe checkout experience.</p>
        </div>
      </section>

      <section className="page-shell section checkout-grid reveal">
        {!isHydrated ? (
          <article className="panel checkout-panel">
            <p className="status-text">Preparing checkout...</p>
          </article>
        ) : items.length === 0 ? (
          <article className="panel checkout-panel">
            <span className="eyebrow">Empty Cart</span>
            <h2>Your cart is currently empty</h2>
            <p>Add your brisket, ribs, sides, and drinks before checking out.</p>
            <div className="cta-row">
              <Link className="btn btn-primary" href="/menu">Browse Menu</Link>
              <Link className="btn btn-secondary" href="/">Back Home</Link>
            </div>
          </article>
        ) : (
          <article className="panel checkout-panel">
            <span className="eyebrow">Order Details</span>
            <h2>Customer & Fulfillment Info</h2>
            <p>Tell us who this order is for and how you want to receive it.</p>

            <div className="checkout-form-grid">
              <label>
                Full Name
                <input type="text" value={details.name} onChange={(event) => setField("name", event.target.value)} />
                {formErrors.name ? <span className="form-error">{formErrors.name}</span> : null}
              </label>

              <div className="checkout-form-row">
                <label>
                  Email
                  <input type="email" value={details.email} onChange={(event) => setField("email", event.target.value)} />
                  {formErrors.email ? <span className="form-error">{formErrors.email}</span> : null}
                </label>
                <label>
                  Phone
                  <input type="tel" value={details.phone} onChange={(event) => setField("phone", event.target.value)} />
                  {formErrors.phone ? <span className="form-error">{formErrors.phone}</span> : null}
                </label>
              </div>

              <div className="checkout-form-row">
                <label>
                  Fulfillment
                  <select
                    value={details.fulfillmentMode}
                    onChange={(event) => setField("fulfillmentMode", event.target.value as FulfillmentMode)}
                  >
                    <option value="pickup">Pickup</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </label>

                <label>
                  When
                  <select
                    value={details.fulfillmentSpeed}
                    onChange={(event) => setField("fulfillmentSpeed", event.target.value as FulfillmentSpeed)}
                  >
                    <option value="asap">As soon as possible</option>
                    <option value="scheduled">Schedule for later</option>
                  </select>
                </label>
              </div>

              {details.fulfillmentSpeed === "scheduled" ? (
                <label>
                  Scheduled Time
                  <input
                    type="datetime-local"
                    value={details.scheduledFor}
                    onChange={(event) => setField("scheduledFor", event.target.value)}
                  />
                  {formErrors.scheduledFor ? <span className="form-error">{formErrors.scheduledFor}</span> : null}
                </label>
              ) : null}

              {details.fulfillmentMode === "delivery" ? (
                <label>
                  Delivery Address
                  <input type="text" value={details.address} onChange={(event) => setField("address", event.target.value)} />
                  {formErrors.address ? <span className="form-error">{formErrors.address}</span> : null}
                </label>
              ) : null}

              <label>
                Order Notes
                <textarea
                  rows={3}
                  value={details.orderNotes}
                  onChange={(event) => setField("orderNotes", event.target.value)}
                  placeholder="Sauce on side, no pickles, extra napkins, etc."
                />
              </label>

              <div className="tip-panel">
                <p>Tip</p>
                <div className="tip-options">
                  {[0, 15, 18, 20].map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      className={tipPercent === percent && customTipCents === null ? "tip-btn active" : "tip-btn"}
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
                    className={customTipCents !== null ? "tip-btn active" : "tip-btn"}
                    onClick={() => {
                      setTipPercent(0);
                      setCustomTipCents(Math.round(subtotalCents * 0.2));
                    }}
                  >
                    Custom
                  </button>
                </div>
                {customTipCents !== null ? (
                  <label>
                    Custom Tip (USD)
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={(customTipCents / 100).toFixed(2)}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setCustomTipCents(Number.isFinite(next) ? Math.max(0, Math.round(next * 100)) : 0);
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>

            {!checkoutStarted ? (
              <button className="btn btn-primary" style={{ marginTop: "1rem", width: "100%" }} onClick={startCheckout}>
                Continue to Secure Payment
              </button>
            ) : null}

            {errorMessage ? <p className="status-text" style={{ marginTop: "1rem" }}>{errorMessage}</p> : null}

            {checkoutStarted && checkoutOptions && stripePromise ? (
              <div style={{ marginTop: "1rem" }}>
                <CheckoutElementsProvider stripe={stripePromise} options={checkoutOptions}>
                  <PaymentForm />
                </CheckoutElementsProvider>
              </div>
            ) : checkoutStarted && !errorMessage ? (
              <p className="status-text" style={{ marginTop: "1rem" }}>Preparing secure payment...</p>
            ) : null}
          </article>
        )}

        <article className="panel checkout-summary">
          <span className="eyebrow">Order Summary</span>
          <h3>Your Order</h3>
          {items.length === 0 ? <p className="status-text">No items yet.</p> : null}
          <div style={{ marginBottom: "1.25rem" }}>
            {items.map((item: CartItem, index: number) => (
              <div
                key={`${item.menuItemId}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid var(--line)"
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{item.name} x {item.quantity}</div>
                  {item.customizations.length > 0 ? (
                    <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)", marginTop: "0.25rem" }}>
                      {item.customizations.map((customization) => customization.name).join(", ")}
                    </div>
                  ) : null}
                  {item.notes ? (
                    <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)", marginTop: "0.25rem", fontStyle: "italic" }}>
                      Note: {item.notes}
                    </div>
                  ) : null}
                </div>
                <div style={{ fontWeight: 500, whiteSpace: "nowrap", marginLeft: "1rem" }}>
                  ${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "2px solid var(--ember)", paddingTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span>Subtotal</span>
              <span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span>Estimated Tax</span>
              <span>${(estimatedTaxCents / 100).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span>Tip</span>
              <span>${(tipCents / 100).toFixed(2)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "0.75rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--line)",
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--ember)"
              }}
            >
              <span>Estimated Total</span>
              <span>${(totalBeforePaymentCents / 100).toFixed(2)}</span>
            </div>
          </div>

          <div className="booking-contact" style={{ marginTop: "1.5rem" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--warm-gray)" }}>Questions? Contact us:</p>
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

      <style jsx>{`
        .checkout-form-grid {
          display: grid;
          gap: 0.85rem;
          margin-top: 1rem;
        }

        .checkout-form-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8rem;
        }

        .checkout-form-grid label {
          display: grid;
          gap: 0.4rem;
          color: var(--warm-gray);
          font-size: 0.95rem;
        }

        .checkout-form-grid input,
        .checkout-form-grid select,
        .checkout-form-grid textarea {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 0.6rem;
          background: rgba(16, 32, 41, 0.7);
          color: var(--cream);
          min-height: 2.7rem;
          padding: 0.65rem 0.75rem;
        }

        .checkout-form-grid textarea {
          min-height: 6.5rem;
          resize: vertical;
        }

        .form-error {
          color: #ff9980;
          font-size: 0.84rem;
        }

        .tip-panel {
          border: 1px solid var(--line);
          border-radius: 0.65rem;
          padding: 0.75rem;
          display: grid;
          gap: 0.65rem;
        }

        .tip-panel p {
          margin: 0;
          font-size: 0.95rem;
          color: var(--cream);
        }

        .tip-options {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tip-btn {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(16, 32, 41, 0.75);
          color: var(--cream);
          border-radius: 999px;
          min-height: 2.2rem;
          padding: 0.4rem 0.7rem;
          cursor: pointer;
        }

        .tip-btn.active {
          border-color: rgba(217, 109, 49, 0.65);
          background: rgba(217, 109, 49, 0.22);
        }

        @media (max-width: 768px) {
          .checkout-form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
