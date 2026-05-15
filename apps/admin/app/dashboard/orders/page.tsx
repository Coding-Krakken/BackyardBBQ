'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, Select, SelectItem, TextInput, Button } from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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

  const filteredOrders = (data?.data ?? []).filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && order.source !== sourceFilter) return false;
    if (searchQuery && !order.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
        await mutate();
        setSelectedOrder(null);
        setNewStatus('');
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager', 'staff']}>
    <div className="p-6">
      <PageHeader
        title="Orders"
        subtitle="Manage all incoming orders from all channels"
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectItem value="all">All Statuses</SelectItem>
              {ORDER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Source</label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectItem value="all">All Sources</SelectItem>
              {ORDER_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {source.toUpperCase()}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Search Order ID</label>
            <TextInput
              placeholder="Enter order ID..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card>
        <DataTable
          columns={[
            { header: 'Order ID', accessor: (row: Order) => row.id.slice(0, 8) },
            { header: 'Source', accessor: (row: Order) => row.source.toUpperCase() },
            {
              header: 'Status',
              accessor: (row: Order) => <StatusBadge status={row.status} />,
            },
            { header: 'Total', accessor: (row: Order) => formatCurrency(row.totalCents) },
            { header: 'Location', accessor: (row: Order) => row.location?.name ?? 'N/A' },
            { header: 'Created', accessor: (row: Order) => formatDate(row.createdAt) },
            {
              header: 'Actions',
              accessor: (row: Order) => (
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/orders/${row.id}`}
                    className="inline-flex items-center rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800"
                  >
                    View
                  </Link>
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setSelectedOrder(row.id);
                      setNewStatus(row.status);
                    }}
                  >
                    Update Status
                  </Button>
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
      </Card>

      {/* Status Update Dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-semibold text-bbq-light">Update Order Status</h3>
            <p className="mt-2 text-sm text-gray-400">Select the new status for this order:</p>
            <div className="mt-4">
              <Select value={newStatus} onValueChange={setNewStatus}>
                {ORDER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedOrder(null);
                  setNewStatus('');
                }}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                color="orange"
                onClick={handleStatusUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
    </RoleGate>
  );
}
