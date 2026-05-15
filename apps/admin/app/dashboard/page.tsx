'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Card, Metric, Text } from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface OverviewData {
  totals: {
    pendingOrders: number;
    activeBookings: number;
    grossSalesCentsToday: number;
  };
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
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  const { data: ordersData } = useSWR<{ data: Order[] }>(
    '/api/admin/orders?limit=5',
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: bookingsData } = useSWR<{ data: Booking[] }>(
    '/api/admin/catering/bookings?limit=5',
    fetcher
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
    <div className="p-6">
      <PageHeader
        title="Mission Control"
        subtitle="Real-time overview of your restaurant operations"
      />

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {overviewLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <Card>
              <Text>Pending Orders</Text>
              <Metric>{overview?.totals.pendingOrders ?? 0}</Metric>
            </Card>
            <Card>
              <Text>Active Bookings</Text>
              <Metric>{overview?.totals.activeBookings ?? 0}</Metric>
            </Card>
            <Card>
              <Text>Gross Sales Today</Text>
              <Metric>
                {formatCurrency(overview?.totals.grossSalesCentsToday ?? 0)}
              </Metric>
            </Card>
          </>
        )}
      </div>

      {/* Recent Orders */}
      <div className="mb-8">
        <h3 className="mb-4 text-lg font-semibold text-bbq-light">Recent Orders</h3>
        <Card>
          <DataTable
            columns={[
              { header: 'Order ID', accessor: (row: Order) => row.id.slice(0, 8) },
              { header: 'Source', accessor: (row: Order) => row.source.toUpperCase() },
              { header: 'Status', accessor: (row: Order) => <StatusBadge status={row.status} /> },
              { header: 'Total', accessor: (row: Order) => formatCurrency(row.totalCents) },
              { header: 'Location', accessor: (row: Order) => row.location?.name ?? 'N/A' },
              { header: 'Created', accessor: (row: Order) => formatDate(row.createdAt) },
            ]}
            data={ordersData?.data ?? []}
          />
        </Card>
      </div>

      {/* Recent Bookings */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-bbq-light">Recent Catering Bookings</h3>
        <Card>
          <DataTable
            columns={[
              { header: 'Booking ID', accessor: (row: Booking) => row.id.slice(0, 8) },
              { header: 'Event Date', accessor: (row: Booking) => formatDate(row.eventDate) },
              { header: 'Party Size', accessor: (row: Booking) => row.partySize },
              { header: 'Status', accessor: (row: Booking) => <StatusBadge status={row.status} /> },
              { header: 'Package', accessor: (row: Booking) => row.packageName ?? 'Custom' },
              { header: 'Location', accessor: (row: Booking) => row.location?.name ?? 'N/A' },
            ]}
            data={bookingsData?.data ?? []}
          />
        </Card>
      </div>
    </div>
    </RoleGate>
  );
}
