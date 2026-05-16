"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SiteNavbar } from "../../components/SiteNavbar";
import { SiteFooter } from "../../components/HomeSections";
import { siteImages } from "../../config/images";
import { useCart } from "../../components/cart/CartContext";

export const dynamic = 'force-dynamic';

interface PaymentSummary {
  currency?: string | null;
  amountSubtotal?: number | null;
  amountTax?: number | null;
  amountTotal?: number | null;
}

function formatMoney(amountCents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { dispatch } = useCart();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    // Verify the session and clear cart
    const verifySession = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/payments/verify-session?session_id=${sessionId}`
        );
        
        if (response.ok) {
          const data = (await response.json()) as {
            status?: string;
            currency?: string;
            amountSubtotal?: number;
            amountTax?: number;
            amountTotal?: number;
          };
          if (data.status === "complete") {
            // Clear the cart
            dispatch({ type: "CLEAR_CART" });
            setPaymentSummary({
              currency: data.currency,
              amountSubtotal: data.amountSubtotal,
              amountTax: data.amountTax,
              amountTotal: data.amountTotal,
            });
            setStatus("success");
          } else {
            setStatus("error");
          }
        } else {
          setStatus("error");
        }
      } catch (error) {
        console.error("Error verifying session:", error);
        setStatus("error");
      }
    };

    verifySession();
  }, [sessionId, dispatch]);

  return (
    <main id="main-content">
      <SiteNavbar />

      <section className="subpage-hero reveal">
        <Image 
          src={siteImages.hero.src} 
          alt={siteImages.hero.alt} 
          fill 
          priority 
          sizes="100vw" 
          className="hero-bg" 
        />
        <div className="hero-overlay" />
        <div className="page-shell subpage-hero-content narrow">
          <span className="hero-eyebrow">
            {status === "loading" ? "Processing..." : status === "success" ? "Success!" : "Error"}
          </span>
          <h1>
            {status === "loading" && "Confirming Your Order"}
            {status === "success" && "Thank You for Your Order!"}
            {status === "error" && "Payment Issue"}
          </h1>
          <p>
            {status === "loading" && "Please wait while we confirm your payment..."}
            {status === "success" && "Your payment has been processed successfully. We'll start preparing your delicious BBQ order right away!"}
            {status === "error" && "We couldn't confirm your payment. Please contact us if you believe this is an error."}
          </p>
        </div>
      </section>

      <section className="page-shell section narrow reveal">
        <article className="panel">
          {status === "success" && (
            <>
              <h2>What's Next?</h2>
              <p>
                You'll receive an email confirmation shortly with your order details and estimated
                preparation time. Our pit masters are already getting to work on your order!
              </p>
              {paymentSummary ? (
                <div
                  style={{
                    marginTop: "1.25rem",
                    padding: "1rem",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(3, 8, 11, 0.35)",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Payment Summary</h3>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span>Subtotal</span>
                    <span>
                      {typeof paymentSummary.amountSubtotal === "number"
                        ? formatMoney(paymentSummary.amountSubtotal, paymentSummary.currency ?? "usd")
                        : "-"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span>Tax</span>
                    <span>
                      {typeof paymentSummary.amountTax === "number"
                        ? formatMoney(paymentSummary.amountTax, paymentSummary.currency ?? "usd")
                        : "-"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid var(--line-soft)",
                      paddingTop: "0.5rem",
                      fontWeight: 700,
                    }}
                  >
                    <span>Total Paid</span>
                    <span>
                      {typeof paymentSummary.amountTotal === "number"
                        ? formatMoney(paymentSummary.amountTotal, paymentSummary.currency ?? "usd")
                        : "-"}
                    </span>
                  </div>
                </div>
              ) : null}
              <div className="cta-row" style={{ marginTop: "2rem" }}>
                <Link href="/menu" className="btn btn-primary">
                  Order More BBQ
                </Link>
                <Link href="/" className="btn btn-secondary">
                  Back to Home
                </Link>
              </div>
            </>
          )}
          
          {status === "error" && (
            <>
              <h2>Need Help?</h2>
              <p>
                If you have any questions about your payment, please contact us:
              </p>
              <ul>
                <li>Email: hello@backyardbbqking.com</li>
                <li>Phone: +1-555-BBQ-KING</li>
              </ul>
              <div className="cta-row" style={{ marginTop: "2rem" }}>
                <Link href="/checkout" className="btn btn-primary">
                  Try Again
                </Link>
                <Link href="/menu" className="btn btn-secondary">
                  Back to Menu
                </Link>
              </div>
            </>
          )}
          
          {status === "loading" && (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p>Verifying your payment...</p>
            </div>
          )}
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <main id="main-content">
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '2rem' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1>Confirming Your Order</h1>
            <p>Please wait while we confirm your payment...</p>
          </div>
        </div>
      </main>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
