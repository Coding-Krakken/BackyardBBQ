'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { RefundModal, type RefundDraft } from '@/components/RefundModal';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { BBQAreaChart } from '@/components/charts/AreaChart';
import { BBQDonutChart } from '@/components/charts/DonutChart';
import { BBQLineChart } from '@/components/charts/LineChart';
import { useToast } from '@/components/Toast';
import { fetcher, formatCurrency, formatDate } from '@/lib/utils';

interface Transaction {
  id: string;
  orderId: string | null;
  stripePaymentIntentId: string | null;
  paymentType: string;
  provider: string | null;
  amountCents: number;
  status: string;
  createdAt: string;
  refundHistory?: Array<{
    amountCents: number;
    totalRefundedCents: number;
    reason: string;
    refundedAt: string;
    stripeRefundId: string | null;
  }>;
}

interface Dispute {
  id: string;
  disputeId: string;
  paymentIntentId: string;
  reason: string;
  disputeStatus: string;
  dueBy: string | null;
  status: string;
  amountCents: number;
  createdAt: string;
}

interface EvidenceDraft {
  disputeEventId: string;
  customerName: string;
  customerEmail: string;
  orderDetails: string;
  shippingTrackingNumber: string;
  uncategorizedText: string;
}

interface PaymentAnalytics {
  kpis: {
    totalVolumeCents: number;
    successfulVolumeCents: number;
    totalTransactions: number;
    successfulTransactions: number;
    refundedTransactions: number;
    disputeCount: number;
    refundRate: number;
    disputeRate: number;
    successRate: number;
    averagePaymentCents: number;
  };
  dailyVolume: Array<{ date: string; volumeCents: number }>;
  dailyRefunds: Array<{ date: string; refundsCents: number }>;
  paymentTypeBreakdown: Array<{ type: string; count: number }>;
}

interface OpsMetrics {
  windowDays: number;
  kpis: {
    totalTransactions: number;
    successfulTransactions: number;
    refundedTransactions: number;
    settledVolumeCents: number;
    refundedVolumeCents: number;
    disputeCount: number;
    successRate: number;
    refundRate: number;
    disputeRate: number;
    averagePaymentCents: number;
    webhookEvents: number;
    averageWebhookLatencyMs: number;
    lastWebhookAt: string | null;
  };
  daily: Array<{
    date: string;
    revenueCents: number;
    refundsCents: number;
    disputeCount: number;
  }>;
}

const RANGE_DAYS = [7, 30, 90] as const;

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'disputes' | 'analytics'>('transactions');
  const [page, setPage] = useState(1);
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_DAYS)[number]>(30);
  const [disputeStatusFilter, setDisputeStatusFilter] = useState('all');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [bulkRefundReason, setBulkRefundReason] = useState('requested_by_customer');
  const [isBulkRefundOpen, setIsBulkRefundOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundDraft, setRefundDraft] = useState<RefundDraft | null>(null);
  const [evidenceDraft, setEvidenceDraft] = useState<EvidenceDraft | null>(null);
  const { addToast } = useToast();
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data: txData, mutate: mutateTx, isLoading: txLoading } = useSWR<{ data: Transaction[] }>(
    `/api/admin/payments?limit=${limit}&offset=${offset}`,
    fetcher
  );

  const { data: disputeData, mutate: mutateDisputes, isLoading: disputeLoading } = useSWR<{ data: Dispute[] }>(
    `/api/admin/payments/disputes?limit=${limit}&offset=${offset}`,
    fetcher
  );

  const transactions = txData?.data ?? [];

  const refundableTransactions = transactions.filter((tx) => tx.status === 'succeeded');
  const selectedRefundableTransactions = refundableTransactions.filter((tx) =>
    selectedTransactionIds.includes(tx.id)
  );

  const isAllRefundableSelected =
    refundableTransactions.length > 0 &&
    refundableTransactions.every((tx) => selectedTransactionIds.includes(tx.id));

  const filteredDisputes = (disputeData?.data ?? [])
    .filter((dispute) => {
      if (disputeStatusFilter === 'all') {
        return true;
      }
      return dispute.disputeStatus === disputeStatusFilter || dispute.status === disputeStatusFilter;
    })
    .sort((a, b) => {
      if (a.dueBy && b.dueBy) {
        return new Date(a.dueBy).getTime() - new Date(b.dueBy).getTime();
      }
      if (a.dueBy) {
        return -1;
      }
      if (b.dueBy) {
        return 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const getDueLabel = (dueBy: string | null) => {
    if (!dueBy) {
      return 'N/A';
    }

    const dueDate = new Date(dueBy).getTime();
    const now = Date.now();
    const days = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return `Overdue ${Math.abs(days)}d`;
    }
    if (days <= 2) {
      return `Due in ${days}d`;
    }
    return `Due in ${days}d`;
  };

  const rangeEnd = new Date();
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - rangeDays);

  const { data: analyticsData, isLoading: analyticsLoading } = useSWR<PaymentAnalytics>(
    `/api/admin/payments/analytics?startDate=${rangeStart.toISOString()}&endDate=${rangeEnd.toISOString()}`,
    fetcher
  );

  const { data: opsMetricsData, isLoading: opsMetricsLoading } = useSWR<OpsMetrics>(
    `/api/admin/payments/ops-metrics?days=${rangeDays}`,
    fetcher
  );

  const handleRefund = async () => {
    if (!refundDraft) {
      return;
    }

    const amountCents = Math.max(1, Math.min(refundDraft.amountCents, refundDraft.maxAmountCents));

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/payments/${refundDraft.transactionId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountCents,
          reason: refundDraft.reason,
        }),
      });

      if (response.ok) {
        addToast({ type: 'success', message: amountCents === refundDraft.maxAmountCents ? 'Full refund initiated' : 'Partial refund initiated' });
        await mutateTx();
      } else {
        const payload = (await response.json()) as { message?: string };
        addToast({ type: 'error', message: payload.message ?? 'Refund failed' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsProcessing(false);
      setRefundDraft(null);
    }
  };

  const openRefundDialog = (tx: Transaction) => {
    setRefundDraft({
      transactionId: tx.id,
      amountCents: tx.amountCents,
      maxAmountCents: tx.amountCents,
      reason: 'requested_by_customer',
    });
  };

  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactionIds((previous) =>
      previous.includes(transactionId)
        ? previous.filter((id) => id !== transactionId)
        : [...previous, transactionId]
    );
  };

  const toggleSelectAllRefundable = () => {
    if (isAllRefundableSelected) {
      setSelectedTransactionIds([]);
      return;
    }

    setSelectedTransactionIds(refundableTransactions.map((tx) => tx.id));
  };

  const handleBulkRefund = async () => {
    if (selectedRefundableTransactions.length < 2) {
      addToast({ type: 'error', message: 'Select at least 2 successful transactions for bulk refund' });
      return;
    }

    setIsProcessing(true);

    let successCount = 0;
    let failureCount = 0;

    for (const tx of selectedRefundableTransactions) {
      try {
        const response = await fetch(`/api/admin/payments/${tx.id}/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amountCents: tx.amountCents,
            reason: bulkRefundReason,
          }),
        });

        if (response.ok) {
          successCount += 1;
        } else {
          failureCount += 1;
        }
      } catch {
        failureCount += 1;
      }
    }

    await mutateTx();

    setIsProcessing(false);
    setIsBulkRefundOpen(false);
    setSelectedTransactionIds([]);

    if (failureCount === 0) {
      addToast({ type: 'success', message: `Bulk refund complete: ${successCount} succeeded` });
    } else {
      addToast({ type: 'error', message: `Bulk refund finished: ${successCount} succeeded, ${failureCount} failed` });
    }
  };

  const handleDisputeAction = async (disputeId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/payments/disputes/${disputeId}/review`, { method: 'PATCH' });
      if (response.ok) {
        addToast({ type: 'success', message: 'Dispute marked as reviewed' });
        await mutateDisputes();
      } else {
        addToast({ type: 'error', message: 'Action failed' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsProcessing(false);
    }
  };

  const openEvidenceDialog = (disputeEventId: string) => {
    setEvidenceDraft({
      disputeEventId,
      customerName: '',
      customerEmail: '',
      orderDetails: '',
      shippingTrackingNumber: '',
      uncategorizedText: '',
    });
  };

  const submitEvidence = async () => {
    if (!evidenceDraft) {
      return;
    }

    if (evidenceDraft.uncategorizedText.trim().length < 10) {
      addToast({ type: 'error', message: 'Evidence summary must be at least 10 characters' });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/payments/disputes/${evidenceDraft.disputeEventId}/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(evidenceDraft),
      });

      if (response.ok) {
        addToast({ type: 'success', message: 'Dispute evidence submitted' });
        await mutateDisputes();
        setEvidenceDraft(null);
      } else {
        const payload = (await response.json()) as { message?: string };
        addToast({ type: 'error', message: payload.message ?? 'Failed to submit evidence' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsProcessing(false);
    }
  };

  const stripePaymentsBaseUrl = 'https://dashboard.stripe.com/payments';
  const stripeRefundsBaseUrl = 'https://dashboard.stripe.com/refunds';

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'accounting']}>
      <AnimatedPage>
        <PageHeader title="Payments" subtitle="Transaction history and dispute management" />

        <div className="tabs mb-lg">
          <button className={`tab ${activeTab === 'transactions' ? 'tab-active' : ''}`} onClick={() => setActiveTab('transactions')}>Transactions</button>
          <button className={`tab ${activeTab === 'disputes' ? 'tab-active' : ''}`} onClick={() => setActiveTab('disputes')}>Disputes</button>
          <button className={`tab ${activeTab === 'analytics' ? 'tab-active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</button>
        </div>

        {activeTab === 'transactions' && (
          <div className="panel">
            <div className="mb-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className={`btn ${isAllRefundableSelected ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                onClick={toggleSelectAllRefundable}
                disabled={isProcessing || refundableTransactions.length === 0}
              >
                {isAllRefundableSelected ? 'Clear Selection' : 'Select All Refundable'}
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setIsBulkRefundOpen(true)}
                disabled={isProcessing || selectedRefundableTransactions.length < 2}
              >
                Bulk Refund ({selectedRefundableTransactions.length})
              </button>
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                Select at least 2 successful transactions.
              </span>
            </div>

            <DataTable
              columns={[
                {
                  header: '',
                  accessor: (row: Transaction) => (
                    <input
                      type="checkbox"
                      checked={selectedTransactionIds.includes(row.id)}
                      disabled={row.status !== 'succeeded' || isProcessing}
                      onChange={() => toggleTransactionSelection(row.id)}
                      aria-label={`Select transaction ${row.id}`}
                    />
                  ),
                  className: 'text-center',
                },
                { header: 'ID', accessor: (row: Transaction) => row.id.slice(0, 8) },
                { header: 'Order', accessor: (row: Transaction) => row.orderId ? row.orderId.slice(0, 8) : 'N/A' },
                { header: 'Type', accessor: (row: Transaction) => row.paymentType, sortKey: (row: Transaction) => row.paymentType },
                { header: 'Provider', accessor: (row: Transaction) => row.provider ?? 'N/A' },
                { header: 'Amount', accessor: (row: Transaction) => formatCurrency(row.amountCents), sortKey: (row: Transaction) => row.amountCents },
                { header: 'Status', accessor: (row: Transaction) => <StatusBadge status={row.status} type="payment" />, sortKey: (row: Transaction) => row.status },
                {
                  header: 'Refund History',
                  accessor: (row: Transaction) => {
                    const latest = row.refundHistory?.[0];
                    if (!latest) {
                      return <span className="text-muted">None</span>;
                    }

                    const totalEvents = row.refundHistory?.length ?? 0;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span>{formatCurrency(latest.amountCents)} - {latest.reason.replaceAll('_', ' ')}</span>
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                          {totalEvents > 1 ? `${totalEvents} refunds` : '1 refund'} • Total {formatCurrency(latest.totalRefundedCents)}
                        </span>
                        {latest.stripeRefundId ? (
                          <a
                            href={`${stripeRefundsBaseUrl}/${latest.stripeRefundId}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '0.8rem' }}
                          >
                            View refund in Stripe
                          </a>
                        ) : null}
                      </div>
                    );
                  },
                },
                { header: 'Date', accessor: (row: Transaction) => formatDate(row.createdAt), sortKey: (row: Transaction) => row.createdAt },
                { header: 'Actions', accessor: (row: Transaction) => (
                  <div className="flex-gap-sm">
                    {row.status === 'succeeded' ? (
                      <button className="btn btn-danger btn-xs" onClick={() => openRefundDialog(row)} disabled={isProcessing}>
                        Refund
                      </button>
                    ) : null}
                    {row.stripePaymentIntentId ? (
                      <a
                        className="btn btn-ghost btn-xs"
                        href={`${stripePaymentsBaseUrl}/${row.stripePaymentIntentId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Stripe
                      </a>
                    ) : null}
                  </div>
                )},
              ]}
              data={transactions}
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(transactions.length / limit))}
              onPageChange={setPage}
              isLoading={txLoading}
            />
          </div>
        )}

        {activeTab === 'disputes' && (
          <div className="panel">
            <div className="mb-md" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>Status:</strong>
              {['all', 'needs_response', 'under_review', 'won', 'lost', 'reviewed', 'evidence_submitted'].map((status) => (
                <button
                  key={status}
                  className={`btn ${disputeStatusFilter === status ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  onClick={() => setDisputeStatusFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <DataTable
              columns={[
                { header: 'ID', accessor: (row: Dispute) => row.id.slice(0, 8) },
                { header: 'Dispute', accessor: (row: Dispute) => row.disputeId.slice(0, 8) },
                { header: 'Payment', accessor: (row: Dispute) => row.paymentIntentId ? row.paymentIntentId.slice(0, 12) : 'N/A' },
                { header: 'Reason', accessor: (row: Dispute) => row.reason },
                { header: 'Due', accessor: (row: Dispute) => getDueLabel(row.dueBy), sortKey: (row: Dispute) => row.dueBy ?? '' },
                { header: 'Amount', accessor: (row: Dispute) => formatCurrency(row.amountCents), sortKey: (row: Dispute) => row.amountCents },
                { header: 'Status', accessor: (row: Dispute) => <StatusBadge status={row.disputeStatus || row.status} />, sortKey: (row: Dispute) => row.disputeStatus || row.status },
                { header: 'Date', accessor: (row: Dispute) => formatDate(row.createdAt), sortKey: (row: Dispute) => row.createdAt },
                { header: 'Actions', accessor: (row: Dispute) => (
                  <div className="flex-gap-sm">
                    {row.status !== 'reviewed' ? (
                      <button className="btn btn-primary btn-xs" onClick={() => handleDisputeAction(row.id)} disabled={isProcessing}>
                        Mark Reviewed
                      </button>
                    ) : null}
                    {row.status !== 'evidence_submitted' ? (
                      <button className="btn btn-ghost btn-xs" onClick={() => openEvidenceDialog(row.id)} disabled={isProcessing}>
                        Submit Evidence
                      </button>
                    ) : null}
                    <Link className="btn btn-ghost btn-xs" href={`/dashboard/payments/disputes/${row.id}`}>
                      View
                    </Link>
                  </div>
                )},
              ]}
              data={filteredDisputes}
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(filteredDisputes.length / limit))}
              onPageChange={setPage}
              isLoading={disputeLoading}
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <>
            <div className="mb-lg flex-gap" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>Range:</strong>
              {RANGE_DAYS.map((days) => (
                <button
                  key={days}
                  className={`btn ${rangeDays === days ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  onClick={() => setRangeDays(days)}
                >
                  Last {days} days
                </button>
              ))}
            </div>

            <div className="grid-cards grid-cards-4 mb-xl">
              <StatCard
                label="Total Volume"
                value={(analyticsData?.kpis.totalVolumeCents ?? 0) / 100}
                prefix="$"
                decimals={2}
              />
              <StatCard
                label="Success Rate"
                value={analyticsData?.kpis.successRate ?? 0}
                suffix="%"
                decimals={1}
              />
              <StatCard
                label="Refund Rate"
                value={analyticsData?.kpis.refundRate ?? 0}
                suffix="%"
                decimals={1}
              />
              <StatCard
                label="Dispute Rate"
                value={analyticsData?.kpis.disputeRate ?? 0}
                suffix="%"
                decimals={1}
              />
            </div>

            <div className="grid-cards grid-cards-2 mb-lg">
              <ChartCard title="Successful Volume Over Time">
                <BBQAreaChart
                  data={analyticsData?.dailyVolume ?? []}
                  index="date"
                  categories={["volumeCents"]}
                  valueFormatter={(v) => formatCurrency(v)}
                />
              </ChartCard>
              <ChartCard title="Payment Type Breakdown">
                <BBQDonutChart
                  data={analyticsData?.paymentTypeBreakdown ?? []}
                  category="count"
                  index="type"
                />
              </ChartCard>
            </div>

            <ChartCard title="Refund Amount Trend">
              <BBQLineChart
                data={analyticsData?.dailyRefunds ?? []}
                index="date"
                categories={["refundsCents"]}
                colors={["#d96d31"]}
                valueFormatter={(v) => formatCurrency(v)}
              />
            </ChartCard>

            <div className="panel mt-lg">
              {analyticsLoading ? (
                <p className="text-muted">Loading payment analytics...</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Total Transactions</td>
                      <td>{analyticsData?.kpis.totalTransactions ?? 0}</td>
                    </tr>
                    <tr>
                      <td>Successful Transactions</td>
                      <td>{analyticsData?.kpis.successfulTransactions ?? 0}</td>
                    </tr>
                    <tr>
                      <td>Refunded Transactions</td>
                      <td>{analyticsData?.kpis.refundedTransactions ?? 0}</td>
                    </tr>
                    <tr>
                      <td>Disputes</td>
                      <td>{analyticsData?.kpis.disputeCount ?? 0}</td>
                    </tr>
                    <tr>
                      <td>Average Payment</td>
                      <td>{formatCurrency(analyticsData?.kpis.averagePaymentCents ?? 0)}</td>
                    </tr>
                    <tr>
                      <td>Successful Volume</td>
                      <td>{formatCurrency(analyticsData?.kpis.successfulVolumeCents ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            <div className="panel mt-lg">
              <h4 className="mb-md">Operational Payment Metrics</h4>
              {opsMetricsLoading ? (
                <p className="text-muted">Loading operational metrics...</p>
              ) : (
                <>
                  <div className="grid-cards grid-cards-4 mb-lg">
                    <StatCard
                      label="Webhook Events"
                      value={opsMetricsData?.kpis.webhookEvents ?? 0}
                    />
                    <StatCard
                      label="Webhook Latency"
                      value={opsMetricsData?.kpis.averageWebhookLatencyMs ?? 0}
                      suffix="ms"
                    />
                    <StatCard
                      label="Settled Volume"
                      value={(opsMetricsData?.kpis.settledVolumeCents ?? 0) / 100}
                      prefix="$"
                      decimals={2}
                    />
                    <StatCard
                      label="Average Payment"
                      value={(opsMetricsData?.kpis.averagePaymentCents ?? 0) / 100}
                      prefix="$"
                      decimals={2}
                    />
                  </div>

                  <div className="grid-cards grid-cards-2">
                    <ChartCard title="Revenue vs Refunds">
                      <BBQAreaChart
                        data={opsMetricsData?.daily ?? []}
                        index="date"
                        categories={["revenueCents", "refundsCents"]}
                        valueFormatter={(v) => formatCurrency(v)}
                      />
                    </ChartCard>
                    <ChartCard title="Daily Disputes">
                      <BBQLineChart
                        data={opsMetricsData?.daily ?? []}
                        index="date"
                        categories={["disputeCount"]}
                        colors={["#c75b4f"]}
                        valueFormatter={(v) => `${v}`}
                      />
                    </ChartCard>
                  </div>

                  <div className="mt-md text-muted" style={{ fontSize: '0.9rem' }}>
                    Last webhook event: {opsMetricsData?.kpis.lastWebhookAt ? formatDate(opsMetricsData.kpis.lastWebhookAt) : 'No events in range'}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <RefundModal
          draft={refundDraft}
          isProcessing={isProcessing}
          onDraftChange={setRefundDraft}
          onClose={() => setRefundDraft(null)}
          onConfirm={handleRefund}
        />

        {isBulkRefundOpen && (
          <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="bulk-refund-title">
            <div className="overlay-backdrop" onClick={() => setIsBulkRefundOpen(false)} />
            <div className="modal modal-sm">
              <h3 id="bulk-refund-title" className="modal-title">Confirm Bulk Refund</h3>
              <p className="text-muted mb-md">
                You are about to issue full refunds for {selectedRefundableTransactions.length} transaction(s).
              </p>

              <label className="form-label" htmlFor="bulk-refund-reason">Reason</label>
              <select
                id="bulk-refund-reason"
                className="select"
                value={bulkRefundReason}
                onChange={(event) => setBulkRefundReason(event.target.value)}
              >
                <option value="requested_by_customer">Requested by customer</option>
                <option value="duplicate">Duplicate charge</option>
                <option value="fraudulent">Fraudulent</option>
                <option value="order_cancelled">Order cancelled</option>
                <option value="other">Other</option>
              </select>

              <div className="modal-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsBulkRefundOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleBulkRefund}
                  disabled={isProcessing || selectedRefundableTransactions.length < 2}
                >
                  {isProcessing ? 'Processing...' : 'Issue Bulk Refund'}
                </button>
              </div>
            </div>
          </div>
        )}

        {evidenceDraft && (
          <div className="overlay">
            <div className="overlay-backdrop" onClick={() => setEvidenceDraft(null)} />
            <div className="modal" style={{ maxWidth: '640px' }}>
              <h3 className="modal-title">Submit Dispute Evidence</h3>
              <p className="text-muted mb-md">
                Provide details that support your dispute response.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    className="input"
                    value={evidenceDraft.customerName}
                    onChange={(event) => setEvidenceDraft({ ...evidenceDraft, customerName: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Email</label>
                  <input
                    className="input"
                    type="email"
                    value={evidenceDraft.customerEmail}
                    onChange={(event) => setEvidenceDraft({ ...evidenceDraft, customerEmail: event.target.value })}
                  />
                </div>
              </div>

              <label className="form-label">Shipping Tracking #</label>
              <input
                className="input"
                value={evidenceDraft.shippingTrackingNumber}
                onChange={(event) => setEvidenceDraft({ ...evidenceDraft, shippingTrackingNumber: event.target.value })}
              />

              <label className="form-label" style={{ marginTop: '0.75rem' }}>Order Details</label>
              <textarea
                className="textarea"
                rows={3}
                value={evidenceDraft.orderDetails}
                onChange={(event) => setEvidenceDraft({ ...evidenceDraft, orderDetails: event.target.value })}
              />

              <label className="form-label" style={{ marginTop: '0.75rem' }}>Evidence Summary</label>
              <textarea
                className="textarea"
                rows={5}
                value={evidenceDraft.uncategorizedText}
                onChange={(event) => setEvidenceDraft({ ...evidenceDraft, uncategorizedText: event.target.value })}
                placeholder="Describe why the charge is valid and include any relevant context."
              />

              <div className="modal-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEvidenceDraft(null)} disabled={isProcessing}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={submitEvidence} disabled={isProcessing}>
                  {isProcessing ? 'Submitting...' : 'Submit Evidence'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatedPage>
    </RoleGate>
  );
}
