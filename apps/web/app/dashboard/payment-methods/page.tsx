"use client";

export const dynamic = 'force-dynamic';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardHeader, DashboardSidebar } from "../components/DashboardLayout";

export default function PaymentMethodsPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <section className="dashboard-section">
              <h1>Payment Methods</h1>
              <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>Loading...</p>
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
        <main id="main-content" className="dashboard-main">
          <section className="dashboard-section">
            <h1>Payment Methods</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              Payments are processed directly through our integrated EPOS system at the point of service.
            </p>
          </section>

          <section className="dashboard-section panel">
            <h3 style={{ margin: 0 }}>Saved Cards</h3>
            <p style={{ marginTop: "1rem", color: "var(--warm-gray)" }}>
              Saved card management is not available with EPOS payment processing. All payment methods
              are handled securely through the EPOS terminal at the time of your order.
            </p>
          </section>
        </main>
      </div>
    </>
  );
}