"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckoutElementsProvider, ExpressCheckoutElement, PaymentElement, useCheckout } from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import { DashboardHeader, DashboardSidebar } from "../../../../dashboard/components/DashboardLayout";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type BookingPayload = {
  booking: {
    id: string;
    eventDate: string;
    partySize: number;
    status: string;
    packageName?: string | null;
    depositCents?: number | null;
    estimatedTotalCents?: number | null;
    location: { name: string };
  };
  depositPaidCents: number;
  depositDueCents: number;
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function DepositCheckoutForm() {
  const checkoutState = useCheckout();
  const [status, setStatus] = useState<string>("");
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
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="checkout-form" onSubmit={onSubmit}>
      <div style={{ marginBottom: "1.5rem" }}>
        <ExpressCheckoutElement onConfirm={() => undefined} />
      </div>

      <PaymentElement
        options={{
          layout: {
            type: "accordion",
            defaultCollapsed: false,
            radios: "auto",
            spacedAccordionItems: true,
          },
        }}
      />

      <button className="btn btn-primary" type="submit" style={{ width: "100%", marginTop: "1.25rem" }} disabled={submitting}>
        {submitting ? "Processing..." : "Pay Deposit"}
      </button>

      {status ? <p className="status-text" style={{ marginTop: "1rem" }}>{status}</p> : null}
    </form>
  );
}

export default function CateringDepositPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bookingId = params?.id;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<BookingPayload | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!bookingId) {
      return;
    }

    const load = async () => {
      try {
        const response = await fetch(`/api/customer/bookings/${bookingId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load booking details.");
        }

        const payload = (await response.json()) as BookingPayload;
        setBookingData(payload);

        if (payload.depositDueCents <= 0) {
          setErrorMessage("Deposit is already paid for this booking.");
          return;
        }

        if (payload.booking.status !== "approved" && payload.booking.status !== "pending_approval") {
          setErrorMessage("This booking is not currently eligible for a deposit payment.");
          return;
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load booking details.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId || !bookingData || errorMessage || initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const createSession = async () => {
      try {
        const response = await fetch("/api/payments/create-catering-deposit-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Unable to initialize deposit checkout.");
        }

        const payload = (await response.json()) as { clientSecret: string };
        setClientSecret(payload.clientSecret);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to initialize deposit checkout.");
      }
    };

    void createSession();
  }, [bookingId, bookingData, errorMessage]);

  const checkoutOptions = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            appearance: {
              theme: "night" as const,
              labels: "floating" as const,
              variables: {
                colorPrimary: "#d4491b",
                colorBackground: "#1a1410",
                colorText: "#f4eee8",
                colorDanger: "#d4491b",
                fontFamily: "system-ui, -apple-system, sans-serif",
                spacingUnit: "4px",
                borderRadius: "8px",
              },
            },
          }
        : undefined,
    [clientSecret]
  );

  if (loading) {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <section className="dashboard-section">
              <h1>Catering Deposit</h1>
              <p style={{ color: "var(--warm-gray)" }}>Loading booking details...</p>
            </section>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader />
      <div className="dashboard-container">
        <DashboardSidebar />
        <main className="dashboard-main" id="main-content">
          <section className="dashboard-section" style={{ maxWidth: "920px" }}>
            <h1>Catering Deposit Payment</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              Secure your event date by paying your required catering deposit.
            </p>
          </section>

          <section className="dashboard-grid" style={{ maxWidth: "920px", gridTemplateColumns: "1fr 1fr" }}>
            <article className="panel dashboard-card">
              <h3>Booking Summary</h3>
              {bookingData ? (
                <div style={{ marginTop: "1rem", display: "grid", gap: "0.6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--warm-gray)" }}>Booking ID</span>
                    <span>{bookingData.booking.id.slice(0, 12)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--warm-gray)" }}>Event Date</span>
                    <span>{new Date(bookingData.booking.eventDate).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--warm-gray)" }}>Party Size</span>
                    <span>{bookingData.booking.partySize} guests</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--warm-gray)" }}>Estimated Total</span>
                    <span>{formatMoney(bookingData.booking.estimatedTotalCents ?? 0)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--warm-gray)" }}>Deposit Already Paid</span>
                    <span>{formatMoney(bookingData.depositPaidCents)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, paddingTop: "0.75rem", borderTop: "1px solid var(--line)" }}>
                    <span>Deposit Due Now</span>
                    <span style={{ color: "var(--ember-soft)" }}>{formatMoney(bookingData.depositDueCents)}</span>
                  </div>
                </div>
              ) : null}

              <div className="cta-row" style={{ marginTop: "1.2rem" }}>
                <button className="btn btn-secondary" onClick={() => router.push("/dashboard/bookings")}>Back to Bookings</button>
                <Link className="btn btn-ghost" href="/catering">New Booking</Link>
              </div>
            </article>

            <article className="panel dashboard-card">
              <h3>Pay Deposit</h3>
              {errorMessage ? <p className="status-text">{errorMessage}</p> : null}
              {!errorMessage && checkoutOptions && stripePromise ? (
                <CheckoutElementsProvider stripe={stripePromise} options={checkoutOptions}>
                  <DepositCheckoutForm />
                </CheckoutElementsProvider>
              ) : null}
              {!errorMessage && !checkoutOptions ? (
                <p style={{ color: "var(--warm-gray)", marginTop: "1rem" }}>Preparing secure payment...</p>
              ) : null}
            </article>
          </section>
        </main>
      </div>
    </>
  );
}
