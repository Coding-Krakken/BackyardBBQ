'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { BBQBarChart } from '@/components/charts/BarChart';
import { BBQDonutChart } from '@/components/charts/DonutChart';
import { CardSkeleton, ChartSkeleton } from '@/components/LoadingSkeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { useToast } from '@/components/Toast';
import { fetcher, formatCurrency } from '@/lib/utils';

interface AccountingData {
  grossCents: number;
  refundsCents: number;
  netCents: number;
  sourceBreakdown: { source: string; grossCents: number; refundsCents: number; netCents: number }[];
  canFinalize: boolean;
}

export default function AccountingPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const { addToast } = useToast();

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set('from', dateFrom);
  if (dateTo) queryParams.set('to', dateTo);

  const { data, isLoading, mutate } = useSWR<AccountingData>(
    `/api/admin/accounting?${queryParams.toString()}`,
    fetcher
  );

  const handleFinalize = async () => {
    if (!data?.canFinalize) return;
    setIsFinalizing(true);
    try {
      const response = await fetch('/api/admin/accounting/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: dateFrom, to: dateTo }),
      });
      if (response.ok) {
        addToast({ type: 'success', message: 'Period finalized successfully' });
        await mutate();
      } else {
        addToast({ type: 'error', message: 'Failed to finalize period' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsFinalizing(false);
      setShowFinalize(false);
    }
  };

  // Derive chart data from source breakdown
  const chartData = (data?.sourceBreakdown ?? []).map((row) => ({
    name: row.source.toUpperCase(),
    gross: row.grossCents / 100,
    net: row.netCents / 100,
  }));

  const donutData = (data?.sourceBreakdown ?? []).map((row) => ({
    name: row.source.toUpperCase(),
    value: row.netCents / 100,
  }));

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'accounting']}>
      <AnimatedPage>
        <PageHeader
          title="Accounting"
          subtitle="Financial reconciliation and reporting"
          action={
            data?.canFinalize ? (
              <button className="btn btn-primary" onClick={() => setShowFinalize(true)} disabled={isFinalizing}>
                {isFinalizing ? 'Finalizing...' : 'Finalize Period'}
              </button>
            ) : undefined
          }
        />

        {/* Date Range */}
        <div className="panel mb-lg">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">To Date</label>
              <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid-cards grid-cards-3 mb-xl">
          {isLoading ? (
            <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
          ) : (
            <>
              <StatCard
                label="Gross Sales"
                value={(data?.grossCents ?? 0) / 100}
                prefix="$"
                decimals={2}
                icon={<span>◆</span>}
              />
              <StatCard
                label="Refunds"
                value={(data?.refundsCents ?? 0) / 100}
                prefix="$"
                decimals={2}
                icon={<span>↩</span>}
                colorClass="text-red"
              />
              <StatCard
                label="Net Revenue"
                value={(data?.netCents ?? 0) / 100}
                prefix="$"
                decimals={2}
                icon={<span>✦</span>}
                colorClass="text-green"
              />
            </>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid-cards grid-cards-2 mb-xl">
          {isLoading ? (
            <><ChartSkeleton /><ChartSkeleton /></>
          ) : (
            <>
              <ChartCard title="Revenue by Source">
                <BBQBarChart
                  data={chartData}
                  index="name"
                  categories={['gross', 'net']}
                  colors={['#d96d31', '#5cb87a']}
                  valueFormatter={(v) => `$${v.toLocaleString()}`}
                  height={240}
                />
              </ChartCard>
              <ChartCard title="Net Revenue Distribution">
                <BBQDonutChart
                  data={donutData}
                  index="name"
                  category="value"
                  valueFormatter={(v) => `$${v.toLocaleString()}`}
                  height={240}
                />
              </ChartCard>
            </>
          )}
        </div>

        {/* Source Breakdown Table */}
        <div className="panel">
          <h4 className="mb-md">Detailed Breakdown</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Gross</th>
                <th>Refunds</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {(data?.sourceBreakdown ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📊</div>
                      <p>Select a date range to view breakdown</p>
                    </div>
                  </td>
                </tr>
              ) : (
                (data?.sourceBreakdown ?? []).map((row) => (
                  <tr key={row.source}>
                    <td>{row.source.toUpperCase()}</td>
                    <td>{formatCurrency(row.grossCents)}</td>
                    <td className="text-danger">{formatCurrency(row.refundsCents)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(row.netCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ConfirmDialog
          isOpen={showFinalize}
          onClose={() => setShowFinalize(false)}
          onConfirm={handleFinalize}
          title="Finalize Period"
          message="Are you sure you want to finalize this accounting period? This will lock all transactions in the selected date range and cannot be undone."
          confirmText="Finalize"
          variant="primary"
          isLoading={isFinalizing}
        />
      </AnimatedPage>
    </RoleGate>
  );
}
