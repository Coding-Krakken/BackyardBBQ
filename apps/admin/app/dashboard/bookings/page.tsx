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
import { fetcher, formatDate } from '@/lib/utils';

interface Booking {
  id: string;
  eventDate: string;
  partySize: number;
  status: string;
  packageName?: string | null;
  location?: { name: string };
  customerName?: string;
  totalCents?: number;
}

const BOOKING_STATUSES = ['inquiry', 'confirmed', 'deposit_paid', 'completed', 'cancelled'];

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, mutate, isLoading } = useSWR<{ data: Booking[] }>(
    `/api/admin/catering/bookings?limit=${limit}&offset=${offset}`,
    fetcher
  );
  const { addToast } = useToast();

  const filteredBookings = (data?.data ?? []).filter((booking) => {
    if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
    if (dateFrom && new Date(booking.eventDate) < new Date(dateFrom)) return false;
    if (dateTo && new Date(booking.eventDate) > new Date(dateTo)) return false;
    return true;
  });

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
        addToast({ type: 'success', message: 'Booking status updated' });
        await mutate();
        setSelectedBooking(null);
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
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
      <AnimatedPage>
        <PageHeader
          title="Catering Bookings"
          subtitle="Manage event bookings and catering requests"
        />

        <div className="panel mb-lg">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
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

        <div className="panel">
          <DataTable
            columns={[
              { header: 'Booking ID', accessor: (row: Booking) => row.id.slice(0, 8) },
              { header: 'Event Date', accessor: (row: Booking) => formatDate(row.eventDate), sortKey: (row: Booking) => row.eventDate },
              { header: 'Party Size', accessor: (row: Booking) => row.partySize, sortKey: (row: Booking) => row.partySize },
              { header: 'Status', accessor: (row: Booking) => <StatusBadge status={row.status} type="booking" />, sortKey: (row: Booking) => row.status },
              { header: 'Package', accessor: (row: Booking) => row.packageName ?? 'Custom' },
              { header: 'Location', accessor: (row: Booking) => row.location?.name ?? 'N/A' },
              {
                header: 'Actions',
                accessor: (row: Booking) => (
                  <div className="flex-gap-sm">
                    <Link href={`/dashboard/bookings/${row.id}`} className="btn btn-ghost btn-xs">View</Link>
                    <button className="btn btn-secondary btn-xs" onClick={() => { setSelectedBooking(row.id); setNewStatus(row.status); }}>
                      Update
                    </button>
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
        </div>

        {selectedBooking && (
          <div className="overlay">
            <div className="overlay-backdrop" onClick={() => { setSelectedBooking(null); setNewStatus(''); }} />
            <div className="modal modal-sm">
              <h3 className="modal-title">Update Booking Status</h3>
              <p className="text-muted mb-md">
                Select the new status for this booking:
              </p>
              <select className="select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
              <div className="modal-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedBooking(null); setNewStatus(''); }} disabled={isUpdating}>Cancel</button>
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
