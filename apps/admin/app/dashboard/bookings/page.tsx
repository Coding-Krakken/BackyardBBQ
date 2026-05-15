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

interface Booking {
  id: string;
  eventDate: string;
  partySize: number;
  status: string;
  packageName?: string | null;
  location?: { name: string };
  createdAt: string;
}

const BOOKING_STATUSES = ['pending_approval', 'approved', 'declined', 'cancelled'];

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, mutate, isLoading } = useSWR<{ data: Booking[] }>(
    `/api/admin/catering/bookings?limit=${limit}&offset=${offset}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const filteredBookings = (data?.data ?? []).filter((booking) => {
    if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
    if (searchQuery && !booking.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    const eventTimestamp = new Date(booking.eventDate).getTime();
    if (startDate) {
      const startTimestamp = new Date(`${startDate}T00:00:00`).getTime();
      if (eventTimestamp < startTimestamp) return false;
    }
    if (endDate) {
      const endTimestamp = new Date(`${endDate}T23:59:59`).getTime();
      if (eventTimestamp > endTimestamp) return false;
    }

    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleStatusUpdate = async () => {
    if (!selectedBooking || !newStatus) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/catering/bookings/${selectedBooking}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await mutate();
        setSelectedBooking(null);
        setNewStatus('');
      }
    } catch (error) {
      console.error('Failed to update booking status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager', 'staff']}>
    <div className="p-6">
      <PageHeader
        title="Catering Bookings"
        subtitle="Manage event bookings and catering requests"
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectItem value="all">All Statuses</SelectItem>
              {BOOKING_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Search Booking ID</label>
            <TextInput
              placeholder="Enter booking ID..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
            />
          </div>
        </div>
      </Card>

      {/* Bookings Table */}
      <Card>
        <DataTable
          columns={[
            { header: 'Booking ID', accessor: (row: Booking) => row.id.slice(0, 8) },
            { header: 'Event Date', accessor: (row: Booking) => formatDate(row.eventDate) },
            { header: 'Party Size', accessor: (row: Booking) => row.partySize },
            {
              header: 'Status',
              accessor: (row: Booking) => <StatusBadge status={row.status} />,
            },
            { header: 'Package', accessor: (row: Booking) => row.packageName ?? 'Custom' },
            { header: 'Location', accessor: (row: Booking) => row.location?.name ?? 'N/A' },
            {
              header: 'Actions',
              accessor: (row: Booking) => (
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/bookings/${row.id}`}
                    className="inline-flex items-center rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800"
                  >
                    View
                  </Link>
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setSelectedBooking(row.id);
                      setNewStatus(row.status);
                    }}
                  >
                    Update Status
                  </Button>
                </div>
              ),
            },
          ]}
          data={filteredBookings}
          currentPage={page}
          totalPages={Math.max(1, Math.ceil((data?.data.length ?? 0) / limit))}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </Card>

      {/* Status Update Dialog */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-semibold text-bbq-light">Update Booking Status</h3>
            <p className="mt-2 text-sm text-gray-400">Select the new status for this booking:</p>
            <div className="mt-4">
              <Select value={newStatus} onValueChange={setNewStatus}>
                {BOOKING_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedBooking(null);
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
