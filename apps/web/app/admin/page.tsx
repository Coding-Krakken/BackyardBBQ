"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const modules = [
  "Unified Order Command Center",
  "Catering Operations Calendar",
  "Accounting and Payout Reconciliation",
  "Forecasting and Channel Analytics"
];

const orderStatuses = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
const bookingStatuses = ["pending_approval", "approved", "declined", "cancelled"];

type OverviewPayload = {
  totals: { pendingOrders: number; activeBookings: number; grossSalesCentsToday: number };
};

type OrderRow = {
  id: string; source: string; status: string; totalCents: number; createdAt: string;
  location?: { name: string };
};

type BookingRow = {
  id: string; eventDate: string; partySize: number; status: string;
  packageName?: string | null; location?: { name: string };
};

type PaymentRow = {
  stripePaymentIntentId: string; orderId?: string | null; amountCents: number;
  currency: string; status: string; createdAt: string;
};

type DisputeRow = {
  id: string; disputeId: string; paymentIntentId: string; amountCents: number;
  reason: string; status: string; createdAt: string;
};

type DailyClosePayload = {
  date: string; finalized: boolean;
  summary: { grossSalesCents: number; refundedCents: number; netSalesCents: number };
  bySource: Array<{ source: string; orders: number; totalCents: number }>;
};

type IntegrationHealthRow = {
  channel: string; status: string; processedCount: number; failedCount: number;
  deadLetterCount: number; latencyMs: number; recordedAt?: string;
};

type DeadLetterRow = {
  id: string; channel: string; eventType: string; status: string;
  payload?: { reason?: string; orderExternalId?: string; retriedAt?: string };
  createdAt: string;
};

type IntegrationAlertPayload = {
  summary: { critical: number; warning: number; info: number };
  alerts: Array<{ severity: "critical" | "warning" | "info"; channel: string; message: string }>;
};

type AnalyticsSalesPayload = {
  windowDays: number;
  totals: { orders: number; grossSalesCents: number; averageOrderValueCents: number };
  daily: Array<{ date: string; orders: number; grossSalesCents: number }>;
  bySource: Array<{ source: string; orders: number; grossSalesCents: number }>;
  topItems: Array<{ name: string; quantity: number; revenueCents: number }>;
};

type AnalyticsForecastPayload = {
  horizonDays: number;
  baseline: { trailingAverageOrders: number; trailingAverageSalesCents: number };
  forecast: Array<{ date: string; predictedOrders: number; predictedSalesCents: number; confidence: number }>;
};

type AnalyticsAnomalyPayload = {
  windowDays: number;
  summary: { critical: number; warning: number; info: number };
  anomalies: Array<{ severity: "critical" | "warning" | "info"; title: string; detail: string }>;
};

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const adminRole = (session?.user as { role?: string })?.role ?? "owner";

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [dailyClose, setDailyClose] = useState<DailyClosePayload | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealthRow[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetterRow[]>([]);
  const [integrationAlerts, setIntegrationAlerts] = useState<IntegrationAlertPayload | null>(null);
  const [analyticsSales, setAnalyticsSales] = useState<AnalyticsSalesPayload | null>(null);
  const [analyticsForecast, setAnalyticsForecast] = useState<AnalyticsForecastPayload | null>(null);
  const [analyticsAnomalies, setAnalyticsAnomalies] = useState<AnalyticsAnomalyPayload | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Auth guard — middleware handles server-side protection, this handles client navigation
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    } else if (status === "authenticated") {
      const role = (session?.user as { role?: string })?.role;
      if (role !== "admin" && role !== "owner") {
        router.replace("/dashboard");
      }
    }
  }, [status, session, router]);

  const readApiError = async (response: Response, fallback: string) => {
    try {
      const payload = (await response.json()) as { message?: string };
      return payload.message ?? fallback;
    } catch { return fallback; }
  };

  const loadDashboardData = async (targetDate = reportDate) => {
    const [
      overviewRes, ordersRes, bookingsRes, paymentsRes, disputesRes, dailyCloseRes,
      integrationHealthRes, deadLetterRes, integrationAlertsRes,
      analyticsSalesRes, analyticsForecastRes, analyticsAnomaliesRes
    ] = await Promise.all([
      fetch(`/api/admin/overview`),
      fetch(`/api/admin/orders?limit=8`),
      fetch(`/api/admin/catering/bookings?limit=8`),
      fetch(`/api/admin/payments?limit=8`),
      fetch(`/api/admin/payments/disputes?limit=8`),
      fetch(`/api/admin/accounting/daily-close?date=${targetDate}`),
      fetch(`/api/admin/integrations/health`),
      fetch(`/api/admin/integrations/dead-letter?limit=8`),
      fetch(`/api/admin/integrations/alerts`),
      fetch(`/api/admin/analytics/sales?days=14`),
      fetch(`/api/admin/analytics/forecast?days=7`),
      fetch(`/api/admin/analytics/anomalies?days=21`)
    ]);

    if (!overviewRes.ok || !ordersRes.ok || !bookingsRes.ok || !paymentsRes.ok ||
        !disputesRes.ok || !dailyCloseRes.ok || !integrationHealthRes.ok ||
        !deadLetterRes.ok || !integrationAlertsRes.ok || !analyticsSalesRes.ok ||
        !analyticsForecastRes.ok || !analyticsAnomaliesRes.ok) {
      throw new Error("Unable to load admin dashboard data.");
    }

    setOverview((await overviewRes.json()) as OverviewPayload);
    setOrders(((await ordersRes.json()) as { data: OrderRow[] }).data);
    setBookings(((await bookingsRes.json()) as { data: BookingRow[] }).data);
    setPayments(((await paymentsRes.json()) as { data: PaymentRow[] }).data);
    setDisputes(((await disputesRes.json()) as { data: DisputeRow[] }).data);
    setDailyClose((await dailyCloseRes.json()) as DailyClosePayload);
    setIntegrationHealth(((await integrationHealthRes.json()) as { data: IntegrationHealthRow[] }).data);
    setDeadLetters(((await deadLetterRes.json()) as { data: DeadLetterRow[] }).data);
    setIntegrationAlerts((await integrationAlertsRes.json()) as IntegrationAlertPayload);
    setAnalyticsSales((await analyticsSalesRes.json()) as AnalyticsSalesPayload);
    setAnalyticsForecast((await analyticsForecastRes.json()) as AnalyticsForecastPayload);
    setAnalyticsAnomalies((await analyticsAnomaliesRes.json()) as AnalyticsAnomalyPayload);
  };

  useEffect(() => {
    if (status === "authenticated" && (adminRole === "admin" || adminRole === "owner")) {
      loadDashboardData(reportDate).catch(() => setErrorMessage("Unable to load admin dashboard data."));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate, status, adminRole]);

  const updateOrderStatus = async (orderId: string, orderStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: orderStatus })
      });
      if (!res.ok) throw new Error(await readApiError(res, "Unable to update order status."));
      setActionMessage(`Order ${orderId} updated to ${orderStatus}.`);
      await loadDashboardData(reportDate);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to update order status.");
    }
  };

  const updateBookingStatus = async (bookingId: string, bookingStatus: string) => {
    try {
      const res = await fetch(`/api/admin/catering/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: bookingStatus })
      });
      if (!res.ok) throw new Error(await readApiError(res, "Unable to update booking status."));
      setActionMessage(`Booking ${bookingId} updated to ${bookingStatus}.`);
      await loadDashboardData(reportDate);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to update booking status.");
    }
  };

  const refundPayment = async (paymentIntentId: string) => {
    try {
      const res = await fetch(`/api/admin/payments/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId })
      });
      if (!res.ok) throw new Error(await readApiError(res, "Unable to create refund."));
      setActionMessage(`Refund created for ${paymentIntentId}.`);
      await loadDashboardData(reportDate);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to create refund.");
    }
  };

  const reviewDispute = async (eventId: string) => {
    try {
      const res = await fetch(`/api/admin/payments/disputes/${eventId}/review`, {
        method: "PATCH"
      });
      if (!res.ok) throw new Error(await readApiError(res, "Unable to mark dispute as reviewed."));
      setActionMessage(`Dispute ${eventId} marked as reviewed.`);
      await loadDashboardData(reportDate);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to mark dispute as reviewed.");
    }
  };

  const retryDeadLetter = async (eventId: string) => {
    try {
      const res = await fetch(`/api/admin/integrations/dead-letter/${eventId}/retry`, {
        method: "PATCH"
      });
      if (!res.ok) throw new Error(await readApiError(res, "Unable to retry dead-letter event."));
      setActionMessage(`Integration dead-letter ${eventId} retried.`);
      await loadDashboardData(reportDate);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to retry dead-letter event.");
    }
  };

  const finalizeDailyClose = async () => {
    try {
      const res = await fetch(`/api/admin/accounting/daily-close/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: reportDate })
      });
      if (!res.ok) throw new Error(await readApiError(res, "Unable to finalize daily close."));
      setActionMessage(`Daily close finalized for ${reportDate}.`);
      await loadDashboardData(reportDate);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to finalize daily close.");
    }
  };

  const exportCsv = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Unable to export CSV.");
      const blob = await res.blob();
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      setActionMessage(`${filename} exported.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to export CSV.");
    }
  };

  const grossSalesText = useMemo(() =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
      .format((overview?.totals.grossSalesCentsToday ?? 0) / 100),
  [overview]);

  if (status === "loading") {
    return <div style={{ minHeight: "100vh", background: "#121313", display: "flex", alignItems: "center", justifyContent: "center", color: "#ebdfce" }}>Loading…</div>;
  }

  return (
    <main className="admin-shell">
      <div className="admin-grid">
        <aside className="admin-sidebar">
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem" }}>Backyard BBQ King</h2>
          <p style={{ margin: "0 0 1rem", opacity: 0.6, fontSize: "0.85rem" }}>Admin Operating System</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {modules.map((m) => <li key={m} style={{ fontSize: "0.85rem", opacity: 0.75 }}>{m}</li>)}
          </ul>
          <div style={{ marginTop: "auto", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <p style={{ fontSize: "0.75rem", opacity: 0.55, margin: "0 0 0.5rem" }}>{session?.user?.email}</p>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "inherit", padding: "0.375rem 0.75rem", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem", width: "100%" }}
            >
              Sign out
            </button>
          </div>
        </aside>

        <section className="admin-surface">
          <h1 style={{ margin: "0 0 0.3rem" }}>Mission Control</h1>
          <p style={{ opacity: 0.6, margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
            Unified direct web orders and delivery-channel operations with payments, reporting, and exception workflows.
          </p>

          {errorMessage && <p className="admin-status-message">{errorMessage}</p>}
          {actionMessage && <p className="admin-success-message">{actionMessage}</p>}

          <div className="admin-kpi-row">
            <article className="admin-card"><strong>Pending Orders</strong><p>{overview?.totals.pendingOrders ?? "--"}</p></article>
            <article className="admin-card"><strong>Active Bookings</strong><p>{overview?.totals.activeBookings ?? "--"}</p></article>
            <article className="admin-card"><strong>Gross Sales Today</strong><p>{grossSalesText}</p></article>
          </div>

          <div className="admin-module-cards">
            {modules.map((m) => <article className="admin-card" key={m}><strong>{m}</strong></article>)}
          </div>

          {/* Orders */}
          <section className="admin-section">
            <h2>Recent Orders</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Order</th><th>Source</th><th>Status</th><th>Total</th><th>Location</th><th>Action</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.id}</td><td>{o.source}</td><td>{o.status}</td>
                      <td>${(o.totalCents / 100).toFixed(2)}</td>
                      <td>{o.location?.name ?? "-"}</td>
                      <td>
                        <div className="admin-inline-row">
                          {orderStatuses.map((s) => (
                            <button key={s} className="admin-mini-btn" type="button" onClick={() => updateOrderStatus(o.id, s)} disabled={o.status === s}>{s}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Catering */}
          <section className="admin-section">
            <h2>Catering Booking Queue</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Booking</th><th>Event Date</th><th>Party</th><th>Status</th><th>Package</th><th>Location</th><th>Action</th></tr></thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td>{new Date(b.eventDate).toLocaleDateString()}</td>
                      <td>{b.partySize}</td><td>{b.status}</td>
                      <td>{b.packageName ?? "-"}</td>
                      <td>{b.location?.name ?? "-"}</td>
                      <td>
                        <div className="admin-inline-row">
                          {bookingStatuses.map((s) => (
                            <button key={s} className="admin-mini-btn" type="button" onClick={() => updateBookingStatus(b.id, s)} disabled={b.status === s}>{s}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Payments */}
          <section className="admin-section">
            <h2>Payments and Refunds</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Payment Intent</th><th>Order</th><th>Amount</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.stripePaymentIntentId}>
                      <td>{p.stripePaymentIntentId}</td><td>{p.orderId ?? "-"}</td>
                      <td>${(p.amountCents / 100).toFixed(2)}</td><td>{p.status}</td>
                      <td>{new Date(p.createdAt).toLocaleString()}</td>
                      <td><button className="admin-mini-btn" type="button" onClick={() => refundPayment(p.stripePaymentIntentId)} disabled={p.status === "refunded"}>Refund</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Disputes */}
          <section className="admin-section">
            <h2>Stripe Disputes</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Dispute</th><th>Payment Intent</th><th>Amount</th><th>Reason</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {disputes.map((d) => (
                    <tr key={d.id}>
                      <td>{d.disputeId}</td><td>{d.paymentIntentId}</td>
                      <td>${(d.amountCents / 100).toFixed(2)}</td>
                      <td>{d.reason}</td><td>{d.status}</td>
                      <td>{new Date(d.createdAt).toLocaleString()}</td>
                      <td><button className="admin-mini-btn" type="button" onClick={() => reviewDispute(d.id)} disabled={d.status === "reviewed"}>Mark Reviewed</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Daily Close */}
          <section className="admin-section">
            <h2>Daily Close</h2>
            <div className="admin-inline-row" style={{ marginBottom: "0.7rem" }}>
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="admin-date-input" />
              <button className="admin-mini-btn" type="button" onClick={finalizeDailyClose}>Finalize Day</button>
              <button className="admin-mini-btn" type="button" onClick={() => exportCsv(`/api/admin/accounting/daily-close/export?date=${reportDate}`, `bbq-daily-close-${reportDate}.csv`)}>Export CSV</button>
            </div>
            <div className="admin-kpi-row">
              <article className="admin-card"><strong>Gross Sales</strong><p>${((dailyClose?.summary.grossSalesCents ?? 0) / 100).toFixed(2)}</p></article>
              <article className="admin-card"><strong>Refunded</strong><p>${((dailyClose?.summary.refundedCents ?? 0) / 100).toFixed(2)}</p></article>
              <article className="admin-card"><strong>Net Sales</strong><p>${((dailyClose?.summary.netSalesCents ?? 0) / 100).toFixed(2)}</p></article>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Source</th><th>Orders</th><th>Total</th></tr></thead>
                <tbody>
                  {(dailyClose?.bySource ?? []).map((s) => (
                    <tr key={s.source}><td>{s.source}</td><td>{s.orders}</td><td>${(s.totalCents / 100).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Analytics */}
          <section className="admin-section">
            <h2>Analytics and Forecasting</h2>
            <div className="admin-inline-row" style={{ marginBottom: "0.7rem" }}>
              <button className="admin-mini-btn" type="button" onClick={() => exportCsv(`/api/admin/analytics/sales/export?days=14`, "bbq-analytics-sales-14d.csv")}>Export Sales CSV</button>
              <button className="admin-mini-btn" type="button" onClick={() => exportCsv(`/api/admin/analytics/forecast/export?days=7`, "bbq-analytics-forecast-7d.csv")}>Export Forecast CSV</button>
            </div>

            {analyticsAnomalies && (
              <>
                <div className="admin-alert-strip">
                  <span className="admin-alert-pill admin-alert-critical">Critical: {analyticsAnomalies.summary.critical}</span>
                  <span className="admin-alert-pill admin-alert-warning">Warning: {analyticsAnomalies.summary.warning}</span>
                  <span className="admin-alert-pill admin-alert-info">Info: {analyticsAnomalies.summary.info}</span>
                </div>
                {analyticsAnomalies.anomalies.length > 0 && (
                  <div className="admin-alert-list" style={{ marginBottom: "0.9rem" }}>
                    {analyticsAnomalies.anomalies.map((a, i) => (
                      <div key={`${a.title}-${i}`} className={`admin-alert-row admin-alert-${a.severity}`}>
                        <strong>{a.title}</strong><span>{a.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="admin-kpi-row">
              <article className="admin-card"><strong>Orders ({analyticsSales?.windowDays ?? 14}d)</strong><p>{analyticsSales?.totals.orders ?? 0}</p></article>
              <article className="admin-card"><strong>Gross ({analyticsSales?.windowDays ?? 14}d)</strong><p>${((analyticsSales?.totals.grossSalesCents ?? 0) / 100).toFixed(2)}</p></article>
              <article className="admin-card"><strong>Avg Ticket</strong><p>${((analyticsSales?.totals.averageOrderValueCents ?? 0) / 100).toFixed(2)}</p></article>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Date</th><th>Orders</th><th>Gross Sales</th></tr></thead>
                <tbody>
                  {(analyticsSales?.daily ?? []).map((r) => (
                    <tr key={r.date}><td>{new Date(r.date).toLocaleDateString()}</td><td>{r.orders}</td><td>${(r.grossSalesCents / 100).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-table-wrap" style={{ marginTop: "0.9rem" }}>
              <table className="admin-table">
                <thead><tr><th>Source</th><th>Orders</th><th>Gross</th></tr></thead>
                <tbody>
                  {(analyticsSales?.bySource ?? []).map((r) => (
                    <tr key={r.source}><td>{r.source}</td><td>{r.orders}</td><td>${(r.grossSalesCents / 100).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-table-wrap" style={{ marginTop: "0.9rem" }}>
              <table className="admin-table">
                <thead><tr><th>Top Item</th><th>Quantity</th><th>Revenue</th></tr></thead>
                <tbody>
                  {(analyticsSales?.topItems ?? []).map((r) => (
                    <tr key={r.name}><td>{r.name}</td><td>{r.quantity}</td><td>${(r.revenueCents / 100).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-table-wrap" style={{ marginTop: "0.9rem" }}>
              <table className="admin-table">
                <thead><tr><th>Forecast Date</th><th>Predicted Orders</th><th>Predicted Sales</th><th>Confidence</th></tr></thead>
                <tbody>
                  {(analyticsForecast?.forecast ?? []).map((r) => (
                    <tr key={r.date}>
                      <td>{new Date(r.date).toLocaleDateString()}</td>
                      <td>{r.predictedOrders}</td>
                      <td>${(r.predictedSalesCents / 100).toFixed(2)}</td>
                      <td>{Math.round(r.confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Integration Operations */}
          <section className="admin-section">
            <h2>Integration Operations</h2>
            {integrationAlerts && (
              <div className="admin-alert-strip">
                <span className="admin-alert-pill admin-alert-critical">Critical: {integrationAlerts.summary.critical}</span>
                <span className="admin-alert-pill admin-alert-warning">Warning: {integrationAlerts.summary.warning}</span>
                <span className="admin-alert-pill admin-alert-info">Info: {integrationAlerts.summary.info}</span>
              </div>
            )}
            {integrationAlerts?.alerts.length ? (
              <div className="admin-alert-list">
                {integrationAlerts.alerts.map((a, i) => (
                  <div key={`${a.channel}-${i}`} className={`admin-alert-row admin-alert-${a.severity}`}>
                    <strong>{a.channel}</strong><span>{a.message}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Channel</th><th>Status</th><th>Processed</th><th>Failed</th><th>Dead Letters</th><th>Latency (ms)</th><th>Recorded</th></tr></thead>
                <tbody>
                  {integrationHealth.map((r) => (
                    <tr key={r.channel}>
                      <td>{r.channel}</td><td>{r.status}</td><td>{r.processedCount}</td>
                      <td>{r.failedCount}</td><td>{r.deadLetterCount}</td><td>{r.latencyMs}</td>
                      <td>{r.recordedAt ? new Date(r.recordedAt).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-table-wrap" style={{ marginTop: "0.9rem" }}>
              <table className="admin-table">
                <thead><tr><th>Event</th><th>Channel</th><th>Status</th><th>Reason</th><th>Order Ref</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {deadLetters.map((r) => (
                    <tr key={r.id}>
                      <td>{r.eventType}</td><td>{r.channel}</td><td>{r.status}</td>
                      <td>{r.payload?.reason ?? "-"}</td><td>{r.payload?.orderExternalId ?? "-"}</td>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                      <td><button className="admin-mini-btn" type="button" onClick={() => retryDeadLetter(r.id)} disabled={r.status === "retried"}>Retry</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
