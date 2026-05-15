"use client";

import { useEffect, useMemo, useState } from "react";

const modules = [
  "Unified Order Command Center",
  "Catering Operations Calendar",
  "Accounting and Payout Reconciliation",
  "Forecasting and Channel Analytics"
];

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const adminRole = process.env.NEXT_PUBLIC_ADMIN_ROLE ?? "owner";
const adminHeaders = {
  "x-admin-role": adminRole
};

type OverviewPayload = {
  totals: {
    pendingOrders: number;
    activeBookings: number;
    grossSalesCentsToday: number;
  };
};

type OrderRow = {
  id: string;
  source: string;
  status: string;
  totalCents: number;
  createdAt: string;
  location?: {
    name: string;
  };
};

type BookingRow = {
  id: string;
  eventDate: string;
  partySize: number;
  status: string;
  packageName?: string | null;
  location?: {
    name: string;
  };
};

type PaymentRow = {
  stripePaymentIntentId: string;
  orderId?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

type DisputeRow = {
  id: string;
  disputeId: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: string;
  createdAt: string;
};

type DailyClosePayload = {
  date: string;
  summary: {
    grossSalesCents: number;
    refundedCents: number;
    netSalesCents: number;
    outstandingDisputes: number;
  };
  bySource: Array<{
    source: string;
    orders: number;
    totalCents: number;
  }>;
};

type IntegrationHealthRow = {
  channel: string;
  status: string;
  processedCount: number;
  failedCount: number;
  deadLetterCount: number;
  latencyMs: number;
  recordedAt: string | null;
};

type DeadLetterRow = {
  id: string;
  channel: string;
  eventType: string;
  status: string;
  payload: {
    reason?: string;
    orderExternalId?: string;
    retriedAt?: string;
  };
  createdAt: string;
};

type IntegrationAlert = {
  severity: "critical" | "warning" | "info";
  channel: string;
  message: string;
};

type IntegrationAlertPayload = {
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
  alerts: IntegrationAlert[];
};

type AnalyticsSalesPayload = {
  windowDays: number;
  totals: {
    orders: number;
    grossSalesCents: number;
    averageOrderValueCents: number;
  };
  daily: Array<{
    date: string;
    orders: number;
    grossSalesCents: number;
  }>;
  bySource: Array<{
    source: string;
    orders: number;
    grossSalesCents: number;
  }>;
  topItems: Array<{
    name: string;
    quantity: number;
    revenueCents: number;
  }>;
};

type AnalyticsForecastPayload = {
  horizonDays: number;
  baseline: {
    trailingAverageOrders: number;
    trailingAverageSalesCents: number;
  };
  forecast: Array<{
    date: string;
    predictedOrders: number;
    predictedSalesCents: number;
    confidence: number;
  }>;
};

type AnalyticsAnomalyPayload = {
  windowDays: number;
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
  anomalies: Array<{
    severity: "critical" | "warning" | "info";
    title: string;
    detail: string;
  }>;
};

const orderStatuses = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
const bookingStatuses = ["pending_approval", "approved", "declined", "cancelled"];

export default function AdminHomePage() {
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

  const readApiError = async (response: Response, fallback: string) => {
    try {
      const payload = (await response.json()) as { message?: string };
      return payload.message ?? fallback;
    } catch {
      return fallback;
    }
  };

  const loadDashboardData = async (targetDate = reportDate) => {
    const [
      overviewResponse,
      ordersResponse,
      bookingsResponse,
      paymentsResponse,
      disputesResponse,
      dailyCloseResponse,
      integrationHealthResponse,
      deadLetterResponse,
      integrationAlertsResponse,
      analyticsSalesResponse,
      analyticsForecastResponse,
      analyticsAnomaliesResponse
    ] = await Promise.all([
      fetch(`${apiBaseUrl}/api/admin/overview`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/orders?limit=8`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/catering/bookings?limit=8`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/payments?limit=8`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/payments/disputes?limit=8`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/accounting/daily-close?date=${targetDate}`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/integrations/health`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/integrations/dead-letter?limit=8`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/integrations/alerts`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/analytics/sales?days=14`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/analytics/forecast?days=7`, { headers: adminHeaders }),
      fetch(`${apiBaseUrl}/api/admin/analytics/anomalies?days=21`, { headers: adminHeaders })
    ]);

    if (
      !overviewResponse.ok ||
      !ordersResponse.ok ||
      !bookingsResponse.ok ||
      !paymentsResponse.ok ||
      !disputesResponse.ok ||
      !dailyCloseResponse.ok ||
      !integrationHealthResponse.ok ||
      !deadLetterResponse.ok ||
      !integrationAlertsResponse.ok ||
      !analyticsSalesResponse.ok ||
      !analyticsForecastResponse.ok ||
      !analyticsAnomaliesResponse.ok
    ) {
      throw new Error("Unable to load admin dashboard data.");
    }

    const overviewPayload = (await overviewResponse.json()) as OverviewPayload;
    const ordersPayload = (await ordersResponse.json()) as { data: OrderRow[] };
    const bookingsPayload = (await bookingsResponse.json()) as { data: BookingRow[] };
    const paymentsPayload = (await paymentsResponse.json()) as { data: PaymentRow[] };
    const disputesPayload = (await disputesResponse.json()) as { data: DisputeRow[] };
    const dailyClosePayload = (await dailyCloseResponse.json()) as DailyClosePayload;
    const integrationHealthPayload = (await integrationHealthResponse.json()) as { data: IntegrationHealthRow[] };
    const deadLetterPayload = (await deadLetterResponse.json()) as { data: DeadLetterRow[] };
    const integrationAlertsPayload = (await integrationAlertsResponse.json()) as IntegrationAlertPayload;
    const analyticsSalesPayload = (await analyticsSalesResponse.json()) as AnalyticsSalesPayload;
    const analyticsForecastPayload = (await analyticsForecastResponse.json()) as AnalyticsForecastPayload;
    const analyticsAnomaliesPayload =
      (await analyticsAnomaliesResponse.json()) as AnalyticsAnomalyPayload;

    setOverview(overviewPayload);
    setOrders(ordersPayload.data);
    setBookings(bookingsPayload.data);
    setPayments(paymentsPayload.data);
    setDisputes(disputesPayload.data);
    setDailyClose(dailyClosePayload);
    setIntegrationHealth(integrationHealthPayload.data);
    setDeadLetters(deadLetterPayload.data);
    setIntegrationAlerts(integrationAlertsPayload);
    setAnalyticsSales(analyticsSalesPayload);
    setAnalyticsForecast(analyticsForecastPayload);
    setAnalyticsAnomalies(analyticsAnomaliesPayload);
  };

  useEffect(() => {
    loadDashboardData(reportDate).catch(() => {
      setErrorMessage("Unable to load admin dashboard data.");
    });
  }, [reportDate]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...adminHeaders
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to update order status."));
      }

      setActionMessage(`Order ${orderId} updated to ${status}.`);
      await loadDashboardData(reportDate);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update order status.");
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/catering/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...adminHeaders
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to update booking status."));
      }

      setActionMessage(`Booking ${bookingId} updated to ${status}.`);
      await loadDashboardData(reportDate);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update booking status.");
    }
  };

  const refundPayment = async (paymentIntentId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/payments/refunds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...adminHeaders
        },
        body: JSON.stringify({
          paymentIntentId
        })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to create refund."));
      }

      setActionMessage(`Refund created for ${paymentIntentId}.`);
      await loadDashboardData(reportDate);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create refund.");
    }
  };

  const reviewDispute = async (eventId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/payments/disputes/${eventId}/review`, {
        method: "PATCH",
        headers: {
          ...adminHeaders
        }
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to mark dispute as reviewed."));
      }

      setActionMessage(`Dispute ${eventId} marked as reviewed.`);
      await loadDashboardData(reportDate);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to mark dispute as reviewed.");
    }
  };

  const retryDeadLetter = async (eventId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/integrations/dead-letter/${eventId}/retry`, {
        method: "PATCH",
        headers: {
          ...adminHeaders
        }
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to retry dead-letter event."));
      }

      setActionMessage(`Integration dead-letter ${eventId} retried.`);
      await loadDashboardData(reportDate);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to retry dead-letter event.");
    }
  };

  const finalizeDailyClose = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/accounting/daily-close/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...adminHeaders
        },
        body: JSON.stringify({ date: reportDate })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to finalize daily close."));
      }

      setActionMessage(`Daily close finalized for ${reportDate}.`);
      await loadDashboardData(reportDate);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to finalize daily close.");
    }
  };

  const exportDailyCloseCsv = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/accounting/daily-close/export?date=${reportDate}`, {
        headers: {
          ...adminHeaders
        }
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to export daily close CSV."));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bbq-daily-close-${reportDate}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setActionMessage(`Daily close CSV exported for ${reportDate}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export daily close CSV.");
    }
  };

  const exportAnalyticsSalesCsv = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/analytics/sales/export?days=14`, {
        headers: {
          ...adminHeaders
        }
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to export analytics sales CSV."));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "bbq-analytics-sales-14d.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      setActionMessage("Analytics sales CSV exported.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export analytics sales CSV.");
    }
  };

  const exportAnalyticsForecastCsv = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/analytics/forecast/export?days=7`, {
        headers: {
          ...adminHeaders
        }
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to export analytics forecast CSV."));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "bbq-analytics-forecast-7d.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      setActionMessage("Analytics forecast CSV exported.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export analytics forecast CSV.");
    }
  };

  const grossSalesText = useMemo(() => {
    if (!overview) {
      return "$0.00";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(overview.totals.grossSalesCentsToday / 100);
  }, [overview]);

  return (
    <main className="admin-shell">
      <div className="admin-grid">
        <aside className="sidebar">
          <h2>Backyard BBQ King</h2>
          <p>Admin Operating System</p>
          <ul>
            <li>Orders</li>
            <li>Catering</li>
            <li>Accounting</li>
            <li>Analytics</li>
            <li>Settings</li>
          </ul>
        </aside>
        <section className="surface">
          <h1>Mission Control</h1>
          <p>
            This dashboard unifies direct web orders and delivery-channel operations with payments,
            reporting, and exception workflows.
          </p>

          {errorMessage ? <p className="status-message">{errorMessage}</p> : null}
          {actionMessage ? <p className="success-message">{actionMessage}</p> : null}

          <div className="kpi-row">
            <article className="card">
              <strong>Pending Orders</strong>
              <p>{overview?.totals.pendingOrders ?? "--"}</p>
            </article>
            <article className="card">
              <strong>Active Bookings</strong>
              <p>{overview?.totals.activeBookings ?? "--"}</p>
            </article>
            <article className="card">
              <strong>Gross Sales Today</strong>
              <p>{grossSalesText}</p>
            </article>
          </div>

          <div className="module-cards">
            {modules.map((module) => (
              <article className="card" key={module}>
                <strong>{module}</strong>
              </article>
            ))}
          </div>

          <section className="orders-section">
            <h2>Recent Orders</h2>
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Location</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{order.source}</td>
                      <td>{order.status}</td>
                      <td>${(order.totalCents / 100).toFixed(2)}</td>
                      <td>{order.location?.name ?? "-"}</td>
                      <td>
                        <div className="inline-action-row">
                          {orderStatuses.map((status) => (
                            <button
                              key={status}
                              className="mini-button"
                              type="button"
                              onClick={() => updateOrderStatus(order.id, status)}
                              disabled={order.status === status}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="orders-section">
            <h2>Catering Booking Queue</h2>
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Event Date</th>
                    <th>Party Size</th>
                    <th>Status</th>
                    <th>Package</th>
                    <th>Location</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>{booking.id}</td>
                      <td>{new Date(booking.eventDate).toLocaleDateString()}</td>
                      <td>{booking.partySize}</td>
                      <td>{booking.status}</td>
                      <td>{booking.packageName ?? "-"}</td>
                      <td>{booking.location?.name ?? "-"}</td>
                      <td>
                        <div className="inline-action-row">
                          {bookingStatuses.map((status) => (
                            <button
                              key={status}
                              className="mini-button"
                              type="button"
                              onClick={() => updateBookingStatus(booking.id, status)}
                              disabled={booking.status === status}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="orders-section">
            <h2>Payments and Refunds</h2>
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Payment Intent</th>
                    <th>Order</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.stripePaymentIntentId}>
                      <td>{payment.stripePaymentIntentId}</td>
                      <td>{payment.orderId ?? "-"}</td>
                      <td>${(payment.amountCents / 100).toFixed(2)}</td>
                      <td>{payment.status}</td>
                      <td>{new Date(payment.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          className="mini-button"
                          type="button"
                          onClick={() => refundPayment(payment.stripePaymentIntentId)}
                          disabled={payment.status === "refunded"}
                        >
                          Refund
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="orders-section">
            <h2>Stripe Disputes</h2>
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Dispute</th>
                    <th>Payment Intent</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((dispute) => (
                    <tr key={dispute.id}>
                      <td>{dispute.disputeId}</td>
                      <td>{dispute.paymentIntentId}</td>
                      <td>${(dispute.amountCents / 100).toFixed(2)}</td>
                      <td>{dispute.reason}</td>
                      <td>{dispute.status}</td>
                      <td>{new Date(dispute.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          className="mini-button"
                          type="button"
                          onClick={() => reviewDispute(dispute.id)}
                          disabled={dispute.status === "reviewed"}
                        >
                          Mark Reviewed
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="orders-section">
            <h2>Daily Close</h2>
            <div className="inline-action-row" style={{ marginBottom: "0.7rem" }}>
              <input
                type="date"
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
                className="date-input"
              />
              <button className="mini-button" type="button" onClick={finalizeDailyClose}>
                Finalize Day
              </button>
              <button className="mini-button" type="button" onClick={exportDailyCloseCsv}>
                Export CSV
              </button>
            </div>

            <div className="kpi-row">
              <article className="card">
                <strong>Gross Sales</strong>
                <p>${((dailyClose?.summary.grossSalesCents ?? 0) / 100).toFixed(2)}</p>
              </article>
              <article className="card">
                <strong>Refunded</strong>
                <p>${((dailyClose?.summary.refundedCents ?? 0) / 100).toFixed(2)}</p>
              </article>
              <article className="card">
                <strong>Net Sales</strong>
                <p>${((dailyClose?.summary.netSalesCents ?? 0) / 100).toFixed(2)}</p>
              </article>
            </div>

            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Orders</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(dailyClose?.bySource ?? []).map((source) => (
                    <tr key={source.source}>
                      <td>{source.source}</td>
                      <td>{source.orders}</td>
                      <td>${(source.totalCents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="orders-section">
            <h2>Analytics and Forecasting</h2>

            <div className="inline-action-row" style={{ marginBottom: "0.7rem" }}>
              <button className="mini-button" type="button" onClick={exportAnalyticsSalesCsv}>
                Export Sales CSV
              </button>
              <button className="mini-button" type="button" onClick={exportAnalyticsForecastCsv}>
                Export Forecast CSV
              </button>
            </div>

            {analyticsAnomalies ? (
              <>
                <div className="alert-strip">
                  <span className="alert-pill alert-critical">Critical: {analyticsAnomalies.summary.critical}</span>
                  <span className="alert-pill alert-warning">Warning: {analyticsAnomalies.summary.warning}</span>
                  <span className="alert-pill alert-info">Info: {analyticsAnomalies.summary.info}</span>
                </div>

                {analyticsAnomalies.anomalies.length ? (
                  <div className="alert-list" style={{ marginBottom: "0.9rem" }}>
                    {analyticsAnomalies.anomalies.map((anomaly, index) => (
                      <div key={`${anomaly.title}-${index}`} className={`alert-row alert-${anomaly.severity}`}>
                        <strong>{anomaly.title}</strong>
                        <span>{anomaly.detail}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="kpi-row">
              <article className="card">
                <strong>Orders ({analyticsSales?.windowDays ?? 14}d)</strong>
                <p>{analyticsSales?.totals.orders ?? 0}</p>
              </article>
              <article className="card">
                <strong>Gross ({analyticsSales?.windowDays ?? 14}d)</strong>
                <p>${((analyticsSales?.totals.grossSalesCents ?? 0) / 100).toFixed(2)}</p>
              </article>
              <article className="card">
                <strong>Avg Ticket</strong>
                <p>${((analyticsSales?.totals.averageOrderValueCents ?? 0) / 100).toFixed(2)}</p>
              </article>
            </div>

            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Gross Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {(analyticsSales?.daily ?? []).map((row) => (
                    <tr key={row.date}>
                      <td>{new Date(row.date).toLocaleDateString()}</td>
                      <td>{row.orders}</td>
                      <td>${(row.grossSalesCents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="orders-table-wrap" style={{ marginTop: "0.9rem" }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Orders</th>
                    <th>Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {(analyticsSales?.bySource ?? []).map((row) => (
                    <tr key={row.source}>
                      <td>{row.source}</td>
                      <td>{row.orders}</td>
                      <td>${(row.grossSalesCents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="orders-table-wrap" style={{ marginTop: "0.9rem" }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Top Item</th>
                    <th>Quantity</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(analyticsSales?.topItems ?? []).map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{row.quantity}</td>
                      <td>${(row.revenueCents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="orders-table-wrap" style={{ marginTop: "0.9rem" }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Forecast Date</th>
                    <th>Predicted Orders</th>
                    <th>Predicted Sales</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {(analyticsForecast?.forecast ?? []).map((row) => (
                    <tr key={row.date}>
                      <td>{new Date(row.date).toLocaleDateString()}</td>
                      <td>{row.predictedOrders}</td>
                      <td>${(row.predictedSalesCents / 100).toFixed(2)}</td>
                      <td>{Math.round(row.confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="orders-section">
            <h2>Integration Operations</h2>
            {integrationAlerts ? (
              <div className="alert-strip">
                <span className="alert-pill alert-critical">Critical: {integrationAlerts.summary.critical}</span>
                <span className="alert-pill alert-warning">Warning: {integrationAlerts.summary.warning}</span>
                <span className="alert-pill alert-info">Info: {integrationAlerts.summary.info}</span>
              </div>
            ) : null}

            {integrationAlerts?.alerts.length ? (
              <div className="alert-list">
                {integrationAlerts.alerts.map((alert, index) => (
                  <div key={`${alert.channel}-${index}`} className={`alert-row alert-${alert.severity}`}>
                    <strong>{alert.channel}</strong>
                    <span>{alert.message}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Processed</th>
                    <th>Failed</th>
                    <th>Dead Letters</th>
                    <th>Latency (ms)</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {integrationHealth.map((row) => (
                    <tr key={row.channel}>
                      <td>{row.channel}</td>
                      <td>{row.status}</td>
                      <td>{row.processedCount}</td>
                      <td>{row.failedCount}</td>
                      <td>{row.deadLetterCount}</td>
                      <td>{row.latencyMs}</td>
                      <td>{row.recordedAt ? new Date(row.recordedAt).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="orders-table-wrap" style={{ marginTop: "0.9rem" }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Order Ref</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deadLetters.map((row) => (
                    <tr key={row.id}>
                      <td>{row.eventType}</td>
                      <td>{row.channel}</td>
                      <td>{row.status}</td>
                      <td>{row.payload?.reason ?? "-"}</td>
                      <td>{row.payload?.orderExternalId ?? "-"}</td>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          className="mini-button"
                          type="button"
                          onClick={() => retryDeadLetter(row.id)}
                          disabled={row.status === "retried"}
                        >
                          Retry
                        </button>
                      </td>
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
