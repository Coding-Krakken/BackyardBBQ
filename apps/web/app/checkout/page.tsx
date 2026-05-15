"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { SiteFooter } from "../components/HomeSections";
import { SiteNavbar } from "../components/SiteNavbar";
import { businessInfo } from "../config/content";
import { siteImages } from "../config/images";

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
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
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
            amountCents: 3200,
            currency: "usd",
            metadata: {
              checkoutContext: "direct-web-order"
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
  }, []);

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
          <span className="eyebrow">Order Support</span>
          <h3>Need Help Before You Pay?</h3>
          <ul>
            <li>Confirm pickup timing and service window</li>
            <li>Coordinate catering deposits and final balances</li>
            <li>Update delivery instructions before confirmation</li>
          </ul>
          <div className="booking-contact">
            <p>{businessInfo.phone}</p>
            <p>{businessInfo.email}</p>
          </div>
          <div className="cta-row">
            <Link className="btn btn-secondary" href="/catering">
              Catering Booking
            </Link>
            <Link className="btn btn-secondary" href="/">
              Back to Home
            </Link>
          </div>
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}
