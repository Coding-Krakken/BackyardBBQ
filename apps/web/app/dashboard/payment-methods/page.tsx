"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardHeader, DashboardSidebar } from "../components/DashboardLayout";

interface SavedPaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

function formatBrand(brand: string) {
  return brand.length > 0 ? `${brand[0]?.toUpperCase() ?? ""}${brand.slice(1)}` : "Card";
}

export default function PaymentMethodsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [defaultMethodId, setDefaultMethodId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyMethodId, setBusyMethodId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      void fetchPaymentMethods();
    }
  }, [status]);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/customer/payment-methods", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load payment methods.");
      }

      const payload = (await response.json()) as {
        paymentMethods: SavedPaymentMethod[];
        defaultPaymentMethodId: string | null;
      };

      setMethods(payload.paymentMethods);
      setDefaultMethodId(payload.defaultPaymentMethodId);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to load payment methods.");
    } finally {
      setLoading(false);
    }
  };

  const setDefault = async (id: string) => {
    try {
      setBusyMethodId(id);
      setStatusMessage(null);

      const response = await fetch(`/api/customer/payment-methods/${id}/set-default`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to update default payment method.");
      }

      setStatusMessage("Default payment method updated.");
      await fetchPaymentMethods();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to update default payment method.");
    } finally {
      setBusyMethodId(null);
    }
  };

  const removeMethod = async (id: string) => {
    try {
      setBusyMethodId(id);
      setStatusMessage(null);

      const response = await fetch(`/api/customer/payment-methods/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to remove payment method.");
      }

      setStatusMessage("Payment method removed.");
      await fetchPaymentMethods();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to remove payment method.");
    } finally {
      setBusyMethodId(null);
    }
  };

  const openPortal = async () => {
    try {
      setStatusMessage(null);
      const response = await fetch("/api/customer/portal-session", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to open billing portal.");
      }

      const payload = (await response.json()) as { url: string };
      window.location.href = payload.url;
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to open billing portal.");
    }
  };

  if (status === "loading" || loading) {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <section className="dashboard-section">
              <h1>Payment Methods</h1>
              <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>Loading your saved cards...</p>
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
              Manage your saved cards. Add new cards securely through Stripe Customer Portal.
            </p>
          </section>

          <section className="dashboard-section panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <h3 style={{ margin: 0 }}>Saved Cards</h3>
              <button className="btn btn-primary" type="button" onClick={openPortal}>
                Open Billing Portal
              </button>
            </div>

            {statusMessage ? (
              <p style={{ marginTop: "1rem", color: "var(--warm-gray)" }}>{statusMessage}</p>
            ) : null}

            {methods.length === 0 ? (
              <p style={{ marginTop: "1rem", color: "var(--warm-gray)" }}>
                You do not have any saved payment methods yet. Complete a checkout to save a card.
              </p>
            ) : (
              <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
                {methods.map((method) => {
                  const isCurrentDefault = method.isDefault || defaultMethodId === method.stripePaymentMethodId;
                  const isBusy = busyMethodId === method.id;

                  return (
                    <article
                      key={method.id}
                      style={{
                        border: "1px solid var(--line-soft)",
                        borderRadius: "var(--radius-sm)",
                        padding: "1rem",
                        background: "rgba(3, 8, 11, 0.4)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <strong style={{ color: "var(--cream)" }}>
                            {formatBrand(method.brand)} ending in {method.last4}
                          </strong>
                          <div style={{ fontSize: "0.9rem", color: "var(--warm-gray)", marginTop: "0.25rem" }}>
                            Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                          </div>
                        </div>

                        {isCurrentDefault ? (
                          <span
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              color: "var(--ember-soft)",
                            }}
                          >
                            DEFAULT
                          </span>
                        ) : null}
                      </div>

                      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={isCurrentDefault || isBusy}
                          onClick={() => setDefault(method.id)}
                        >
                          Set Default
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={isBusy}
                          onClick={() => removeMethod(method.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
