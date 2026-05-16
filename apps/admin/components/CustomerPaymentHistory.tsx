'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { fetcher, formatCurrency, formatDate } from '@/lib/utils';

interface PaymentHistoryRow {
  id: string;
  stripePaymentIntentId: string;
  orderId: string | null;
  bookingId: string | null;
  paymentType: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string;
}

interface PaymentHistoryResponse {
  data: PaymentHistoryRow[];
  aggregates: {
    totalSpentCents: number;
    refundsCents: number;
    disputeCount: number;
    totalTransactions: number;
  };
}

const STATUS_FILTERS = ['all', 'succeeded', 'refunded', 'partially_refunded', 'failed', 'processing'] as const;
const TYPE_FILTERS = ['all', 'order', 'deposit', 'final_payment'] as const;

export function CustomerPaymentHistory({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>('all');
  const [query, setQuery] = useState('');

  const limit = 20;
  const offset = (page - 1) * limit;

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (typeFilter !== 'all') params.set('paymentType', typeFilter);
    if (query.trim()) params.set('q', query.trim());

    return `/api/admin/customers/${customerId}/payments?${params.toString()}`;
  }, [customerId, limit, offset, query, statusFilter, typeFilter]);

  const { data, isLoading } = useSWR<PaymentHistoryResponse>(endpoint, fetcher);

  return (
    <div className="panel">
      <h4 className="mb-md">Payment History</h4>

      <div className="grid-cards grid-cards-4 mb-md">
        <div className="panel" style={{ padding: '0.75rem' }}>
          <p className="text-muted">Lifetime Value</p>
          <p><strong>{formatCurrency(data?.aggregates.totalSpentCents ?? 0)}</strong></p>
        </div>
        <div className="panel" style={{ padding: '0.75rem' }}>
          <p className="text-muted">Refunded Total</p>
          <p><strong>{formatCurrency(data?.aggregates.refundsCents ?? 0)}</strong></p>
        </div>
        <div className="panel" style={{ padding: '0.75rem' }}>
          <p className="text-muted">Disputes</p>
          <p><strong>{data?.aggregates.disputeCount ?? 0}</strong></p>
        </div>
        <div className="panel" style={{ padding: '0.75rem' }}>
          <p className="text-muted">Transactions</p>
          <p><strong>{data?.aggregates.totalTransactions ?? 0}</strong></p>
        </div>
      </div>

      <div className="mb-md" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          placeholder="Search payment or order ID"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          style={{ minWidth: '260px' }}
        />

        <select
          className="select"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number]);
            setPage(1);
          }}
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <select
          className="select"
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value as (typeof TYPE_FILTERS)[number]);
            setPage(1);
          }}
        >
          {TYPE_FILTERS.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={[
          { header: 'Date', accessor: (row: PaymentHistoryRow) => formatDate(row.createdAt), sortKey: (row: PaymentHistoryRow) => row.createdAt },
          {
            header: 'Transaction',
            accessor: (row: PaymentHistoryRow) => (
              <a
                className="link-ember"
                href={`https://dashboard.stripe.com/payments/${row.stripePaymentIntentId}`}
                target="_blank"
                rel="noreferrer"
              >
                {row.stripePaymentIntentId.slice(0, 16)}
              </a>
            ),
          },
          {
            header: 'Reference',
            accessor: (row: PaymentHistoryRow) => {
              if (row.orderId) {
                return (
                  <Link className="link-ember" href={`/dashboard/orders/${row.orderId}`}>
                    Order {row.orderId.slice(0, 8)}
                  </Link>
                );
              }
              if (row.bookingId) {
                return (
                  <Link className="link-ember" href={`/dashboard/bookings/${row.bookingId}`}>
                    Booking {row.bookingId.slice(0, 8)}
                  </Link>
                );
              }
              return 'N/A';
            },
          },
          { header: 'Type', accessor: (row: PaymentHistoryRow) => row.paymentType, sortKey: (row: PaymentHistoryRow) => row.paymentType },
          { header: 'Amount', accessor: (row: PaymentHistoryRow) => formatCurrency(row.amountCents), sortKey: (row: PaymentHistoryRow) => row.amountCents },
          { header: 'Status', accessor: (row: PaymentHistoryRow) => <StatusBadge status={row.status} type="payment" />, sortKey: (row: PaymentHistoryRow) => row.status },
        ]}
        data={data?.data ?? []}
        currentPage={page}
        totalPages={Math.max(1, Math.ceil((data?.data.length ?? 0) / limit))}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyIcon="💳"
        emptyMessage="No payments found for this customer"
      />
    </div>
  );
}
