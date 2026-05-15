'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { useToast } from '@/components/Toast';
import { fetcher, formatCurrency, formatDate } from '@/lib/utils';

interface Order {
  id: string;
  source: string;
  status: string;
  totalCents: number;
  createdAt: string;
  location?: { name: string };
}

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const ORDER_SOURCES = ['direct', 'doordash', 'ubereats', 'grubhub', 'catering'];

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, mutate, isLoading } = useSWR<{ data: Order[] }>(
    `/api/admin/orders?limit=${limit}&offset=${offset}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const { addToast } = useToast();

  const filteredOrders = (data?.data ?? []).filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && order.source !== sourceFilter) return false;
    if (searchQuery && !order.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/orders/${selectedOrder}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        addToast({ type: 'success', message: 'Order status updated' });
        await mutate();
        setSelectedOrder(null);
        setNewStatus('');
      } else {
        addToast({ type: 'error', message: 'Failed to update status' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager', 'staff']}>
      <AnimatedPage>
        <PageHeader
          title="Orders"
          subtitle="Manage all incoming orders from all channels"
        />

        {/* Filters */}
        <div className="panel mb-lg">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Source</label>
              <select className="select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="all">All Sources</option>
                {ORDER_SOURCES.map((s) => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Search Order ID</label>
              <input
                className="input"
                placeholder="Enter order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="panel">
          <DataTable
            columns={[
              { header: 'Order ID', accessor: (row: Order) => row.id.slice(0, 8) },
              { header: 'Source', accessor: (row: Order) => row.source.toUpperCase(), sortKey: (row: Order) => row.source },
              { header: 'Status', accessor: (row: Order) => <StatusBadge status={row.status} />, sortKey: (row: Order) => row.status },
              { header: 'Total', accessor: (row: Order) => formatCurrency(row.totalCents), sortKey: (row: Order) => row.totalCents },
              { header: 'Location', accessor: (row: Order) => row.location?.name ?? 'N/A' },
              { header: 'Created', accessor: (row: Order) => formatDate(row.createdAt), sortKey: (row: Order) => row.createdAt },
              {
                header: 'Actions',
                accessor: (row: Order) => (
                  <div className="flex-gap-sm">
                    <Link href={`/dashboard/orders/${row.id}`} className="btn btn-ghost btn-xs">View</Link>
                    <button className="btn btn-secondary btn-xs" onClick={() => { setSelectedOrder(row.id); setNewStatus(row.status); }}>
                      Update Status
                    </button>
                  </div>
                ),
              },
            ]}
            data={filteredOrders}
            currentPage={page}
            totalPages={Math.max(1, Math.ceil((data?.data.length ?? 0) / limit))}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>

        {/* Status Update Dialog */}
        {selectedOrder && (
          <div className="overlay">
            <div className="overlay-backdrop" onClick={() => { setSelectedOrder(null); setNewStatus(''); }} />
            <div className="modal modal-sm">
              <h3 className="modal-title">Update Order Status</h3>
              <p className="text-muted mb-md">
                Select the new status for this order:
              </p>
              <select className="select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <div className="modal-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedOrder(null); setNewStatus(''); }} disabled={isUpdating}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleStatusUpdate} disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatedPage>
    </RoleGate>
  );
}
