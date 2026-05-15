'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { BBQAreaChart } from '@/components/charts/AreaChart';
import { BBQDonutChart } from '@/components/charts/DonutChart';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { fetcher, formatCurrency } from '@/lib/utils';

interface AnalyticsData {
  kpis: {
    totalRevenueCents: number;
    totalOrders: number;
    avgOrderValueCents: number;
    conversionRate: number;
  };
  revenueOverTime: { date: string; revenue: number }[];
  sourceBreakdown: { source: string; count: number }[];
  topItems: { name: string; count: number; revenue: number }[];
  forecast?: { date: string; predicted: number }[];
  anomalies?: { date: string; metric: string; actual: number; expected: number }[];
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'forecast' | 'anomalies'>('overview');
  const { data, isLoading } = useSWR<AnalyticsData>('/api/admin/analytics', fetcher);

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
      <AnimatedPage>
        <PageHeader title="Analytics" subtitle="Business performance and insights" />

        {/* KPI Cards */}
        <div className="grid-cards grid-cards-4 mb-xl">
          {isLoading ? (
            <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
          ) : (
            <>
              <StatCard
                label="Total Revenue"
                value={(data?.kpis.totalRevenueCents ?? 0) / 100}
                prefix="$"
                decimals={2}
                icon={<span>◆</span>}
              />
              <StatCard
                label="Total Orders"
                value={data?.kpis.totalOrders ?? 0}
                icon={<span>⊞</span>}
              />
              <StatCard
                label="Avg Order Value"
                value={(data?.kpis.avgOrderValueCents ?? 0) / 100}
                prefix="$"
                decimals={2}
                icon={<span>≡</span>}
              />
              <StatCard
                label="Conversion Rate"
                value={data?.kpis.conversionRate ?? 0}
                suffix="%"
                decimals={1}
                icon={<span>↗</span>}
              />
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="tabs mb-lg">
          <button className={`tab ${activeTab === 'overview' ? 'tab-active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`tab ${activeTab === 'forecast' ? 'tab-active' : ''}`} onClick={() => setActiveTab('forecast')}>Forecast</button>
          <button className={`tab ${activeTab === 'anomalies' ? 'tab-active' : ''}`} onClick={() => setActiveTab('anomalies')}>Anomalies</button>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="grid-cards grid-cards-2 mb-lg">
              <ChartCard title="Revenue Over Time">
                <BBQAreaChart
                  data={data?.revenueOverTime ?? []}
                  index="date"
                  categories={['revenue']}
                  valueFormatter={(v) => formatCurrency(v * 100)}
                />
              </ChartCard>
              <ChartCard title="Order Sources">
                <BBQDonutChart
                  data={data?.sourceBreakdown ?? []}
                  category="count"
                  index="source"
                />
              </ChartCard>
            </div>

            <div className="panel">
              <h4 className="mb-md">Top Items</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topItems ?? []).map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.count}</td>
                      <td>{formatCurrency(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'forecast' && (
          <ChartCard title="Revenue Forecast">
            <BBQAreaChart
              data={data?.forecast ?? []}
              index="date"
              categories={['predicted']}
              colors={['#5a9fd4']}
              valueFormatter={(v) => formatCurrency(v * 100)}
            />
          </ChartCard>
        )}

        {activeTab === 'anomalies' && (
          <div className="panel">
            <h4 className="mb-md">Detected Anomalies</h4>
            {(data?.anomalies ?? []).length === 0 ? (
              <p className="text-muted">No anomalies detected</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Metric</th>
                    <th>Actual</th>
                    <th>Expected</th>
                    <th>Deviation</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.anomalies ?? []).map((a, i) => (
                    <tr key={i}>
                      <td>{a.date}</td>
                      <td>{a.metric}</td>
                      <td>{a.actual.toLocaleString()}</td>
                      <td>{a.expected.toLocaleString()}</td>
                      <td className={a.actual > a.expected ? 'text-success' : 'text-danger'}>
                        {((a.actual - a.expected) / a.expected * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </AnimatedPage>
    </RoleGate>
  );
}
