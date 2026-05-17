'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { BBQAreaChart } from '@/components/charts/AreaChart';
import { BBQDonutChart } from '@/components/charts/DonutChart';
import { BBQBarChart } from '@/components/charts/BarChart';
import { CardSkeleton, ChartSkeleton } from '@/components/LoadingSkeleton';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { fetcher, formatCurrency, formatDate } from '@/lib/utils';

interface OverviewData {
  totals: {
    pendingOrders: number;
    activeBookings: number;
    grossSalesCentsToday: number;
    totalCustomers?: number;
    completedOrders?: number;
    avgOrderCents?: number;
  };
  revenueByDay?: { date: string; revenue: number }[];
  ordersBySource?: { source: string; count: number }[];
  ordersByStatus?: { status: string; count: number }[];
}

interface Order {
  id: string;
  source: string;
  status: string;
  totalCents: number;
  createdAt: string;
  location?: { name: string };
}

interface Booking {
  id: string;
  eventDate: string;
  partySize: number;
  status: string;
  packageName?: string | null;
  location?: { name: string };
}

export default function DashboardOverviewPage() {
  const { data: overview, isLoading: overviewLoading } = useSWR<OverviewData>(
    '/api/admin/overview',
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: ordersData } = useSWR<{ data: Order[] }>(
    '/api/admin/orders?limit=8',
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: bookingsData } = useSWR<{ data: Booking[] }>(
    '/api/admin/catering/bookings?limit=5',
    fetcher
  );

  // Derive chart data from recent orders when API doesn't provide breakdowns
  const revenueChartData = useMemo(() => {
    if (overview?.revenueByDay) return overview.revenueByDay;
    if (!ordersData?.data) return [];
    const byDay: Record<string, number> = {};
    ordersData.data.forEach((o) => {
      const day = new Date(o.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
      byDay[day] = (byDay[day] ?? 0) + o.totalCents / 100;
    });
    return Object.entries(byDay).map(([date, revenue]) => ({ date, revenue }));
  }, [overview, ordersData]);

  const sourceChartData = useMemo(() => {
    if (overview?.ordersBySource) return overview.ordersBySource;
    if (!ordersData?.data) return [];
    const bySrc: Record<string, number> = {};
    ordersData.data.forEach((o) => {
      const src = o.source.toUpperCase();
      bySrc[src] = (bySrc[src] ?? 0) + 1;
    });
    return Object.entries(bySrc).map(([name, value]) => ({ name, value }));
  }, [overview, ordersData]);

  const statusChartData = useMemo(() => {
    if (overview?.ordersByStatus) return overview.ordersByStatus;
    if (!ordersData?.data) return [];
    const byStat: Record<string, number> = {};
    ordersData.data.forEach((o) => {
      byStat[o.status] = (byStat[o.status] ?? 0) + 1;
    });
    return Object.entries(byStat).map(([name, value]) => ({ name, value }));
  }, [overview, ordersData]);

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
      <AnimatedPage>
        <div className="dashboard-stack">
          <PageHeader
            title="Mission Control"
            subtitle="Real-time overview of your restaurant operations"
          />

          {/* KPI Cards — Primary Metrics */}
          <section className="dashboard-section">
            <div className="grid-cards grid-cards-4">
              {overviewLoading ? (
                <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
              ) : (
                <>
                  <StatCard
                    label="Pending Orders"
                    value={overview?.totals.pendingOrders ?? 0}
                    icon={<span>⊞</span>}
                  />
                  <StatCard
                    label="Active Bookings"
                    value={overview?.totals.activeBookings ?? 0}
                    icon={<span>◈</span>}
                  />
                  <StatCard
                    label="Today&rsquo;s Revenue"
                    value={(overview?.totals.grossSalesCentsToday ?? 0) / 100}
                    prefix="$"
                    decimals={2}
                    icon={<span>◆</span>}
                  />
                  <StatCard
                    label="Avg Order Value"
                    value={(overview?.totals.avgOrderCents ?? 0) / 100}
                    prefix="$"
                    decimals={2}
                    icon={<span>◇</span>}
                  />
                </>
              )}
            </div>
          </section>

          {/* Charts Row */}
          <section className="dashboard-section">
            <div className="grid-cards grid-cards-2">
              {overviewLoading ? (
                <><ChartSkeleton /><ChartSkeleton /></>
              ) : (
                <>
                  <ChartCard title="Revenue Trend">
                    <BBQAreaChart
                      data={revenueChartData}
                      index="date"
                      categories={['revenue']}
                      valueFormatter={(v) => `$${v.toLocaleString()}`}
                      height={260}
                    />
                  </ChartCard>
                  <ChartCard title="Orders by Source">
                    <BBQDonutChart
                      data={sourceChartData}
                      index="name"
                      category="value"
                      height={260}
                    />
                  </ChartCard>
                </>
              )}
            </div>
          </section>

          {/* Secondary chart + quick stats */}
          <section className="dashboard-section">
            <div className="grid-cards grid-cards-3">
              {overviewLoading ? (
                <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
              ) : (
                <>
                  <div className="panel dashboard-wide-panel">
                    <div className="chart-header">
                      <h3 className="chart-title">Order Status Breakdown</h3>
                    </div>
                    <div className="chart-body">
                      <BBQBarChart
                        data={statusChartData}
                        index="name"
                        categories={['value']}
                        height={200}
                      />
                    </div>
                  </div>
                  <div className="panel">
                    <h3 className="chart-title mb-md">Quick Stats</h3>
                    <dl className="detail-list">
                      <div className="detail-list-item">
                        <dt>Total Customers</dt>
                        <dd>{overview?.totals.totalCustomers ?? '—'}</dd>
                      </div>
                      <div className="detail-list-item">
                        <dt>Completed Orders</dt>
                        <dd>{overview?.totals.completedOrders ?? '—'}</dd>
                      </div>
                      <div className="detail-list-item">
                        <dt>Active Bookings</dt>
                        <dd>{overview?.totals.activeBookings ?? 0}</dd>
                      </div>
                    </dl>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Recent Orders */}
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h3 className="dashboard-section-title">Recent Orders</h3>
              <Link href="/dashboard/orders" className="btn btn-ghost btn-sm">View All →</Link>
            </div>
            <div className="panel">
              <DataTable
                columns={[
                  { header: 'Order ID', accessor: (row: Order) => row.id.slice(0, 8) },
                  { header: 'Source', accessor: (row: Order) => row.source.toUpperCase() },
                  { header: 'Status', accessor: (row: Order) => <StatusBadge status={row.status} /> },
                  { header: 'Total', accessor: (row: Order) => formatCurrency(row.totalCents), sortKey: (row: Order) => row.totalCents },
                  { header: 'Location', accessor: (row: Order) => row.location?.name ?? 'N/A' },
                  { header: 'Created', accessor: (row: Order) => formatDate(row.createdAt), sortKey: (row: Order) => row.createdAt },
                ]}
                data={ordersData?.data ?? []}
              />
            </div>
          </section>

          {/* Recent Bookings */}
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h3 className="dashboard-section-title">Upcoming Catering Bookings</h3>
              <Link href="/dashboard/bookings" className="btn btn-ghost btn-sm">View All →</Link>
            </div>
            <div className="panel">
              <DataTable
                columns={[
                  { header: 'Booking ID', accessor: (row: Booking) => row.id.slice(0, 8) },
                  { header: 'Event Date', accessor: (row: Booking) => formatDate(row.eventDate), sortKey: (row: Booking) => row.eventDate },
                  { header: 'Party Size', accessor: (row: Booking) => row.partySize, sortKey: (row: Booking) => row.partySize },
                  { header: 'Status', accessor: (row: Booking) => <StatusBadge status={row.status} type="booking" /> },
                  { header: 'Package', accessor: (row: Booking) => row.packageName ?? 'Custom' },
                  { header: 'Location', accessor: (row: Booking) => row.location?.name ?? 'N/A' },
                ]}
                data={bookingsData?.data ?? []}
              />
            </div>
          </section>
        </div>
      </AnimatedPage>
    </RoleGate>
  );
}
