"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DashboardHeader, DashboardSidebar } from "../../../../../dashboard/components/DashboardLayout";

export default function CateringDepositSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch(`/api/payments/verify-session?session_id=${sessionId}`);
        if (!response.ok) {
          setStatus("error");
          return;
        }

        const payload = (await response.json()) as { status?: string };
        setStatus(payload.status === "complete" ? "success" : "error");
      } catch {
        setStatus("error");
      }
    };

    void verify();
  }, [sessionId]);

  return (
    <>
      <DashboardHeader />
      <div className="dashboard-container">
        <DashboardSidebar />
        <main className="dashboard-main" id="main-content">
          <section className="dashboard-section" style={{ maxWidth: "860px" }}>
            <h1>{status === "success" ? "Deposit Paid" : status === "loading" ? "Verifying Payment" : "Payment Issue"}</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              {status === "success"
                ? "Your catering deposit was received successfully. We will confirm your event details shortly."
                : status === "loading"
                  ? "Please wait while we confirm your deposit payment."
                  : "We could not confirm your payment. Please contact support if your card was charged."}
            </p>
          </section>

          <section className="dashboard-section panel" style={{ maxWidth: "860px" }}>
            <div className="cta-row">
              <Link className="btn btn-primary" href="/dashboard/bookings">Back to Bookings</Link>
              <Link className="btn btn-secondary" href="/catering">Book Another Event</Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
