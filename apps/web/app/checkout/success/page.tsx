"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SiteNavbar } from "../../components/SiteNavbar";
import { SiteFooter } from "../../components/HomeSections";
import { siteImages } from "../../config/images";
import { useCart } from "../../components/cart/CartContext";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { dispatch } = useCart();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

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
          const data = await response.json();
          if (data.status === "complete") {
            // Clear the cart
            dispatch({ type: "CLEAR_CART" });
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
