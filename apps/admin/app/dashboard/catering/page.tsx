'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { fetcher, formatDate } from '@/lib/utils';

interface CateringInquiry {
  id: string;
  referenceNumber: string;
  eventDate: string;
  partySize: number;
  eventLocation: string;
  foodPreferences: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  additionalNotes?: string | null;
  status: string;
  createdAt: string;
}

const INQUIRY_STATUSES = ['all', 'pending', 'contacted', 'booked', 'declined', 'cancelled'];

export default function CateringInquiriesPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const limit = 20;
  const offset = (page - 1) * limit;

  const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
  const { data, isLoading } = useSWR<{ inquiries: CateringInquiry[]; total: number }>(
    `/api/admin/catering/inquiries?limit=${limit}&offset=${offset}${statusParam}`,
    fetcher
  );

  const inquiries = data?.inquiries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
      <AnimatedPage>
        <PageHeader
          title="Catering Inquiries"
          subtitle="Manage incoming catering requests and follow up with customers."
        />

        <div className="filters-row">
          <label className="filter-label">
            Status
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              {INQUIRY_STATUSES.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </label>
          <span className="result-count">{total} {total === 1 ? 'inquiry' : 'inquiries'}</span>
        </div>

        {isLoading ? (
          <div className="loading-state">Loading inquiries...</div>
        ) : inquiries.length === 0 ? (
          <div className="empty-state">No catering inquiries found.</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Contact</th>
                  <th>Event Date</th>
                  <th>Guests</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td className="mono">{inquiry.referenceNumber}</td>
                    <td>
                      <div className="contact-cell">
                        <strong>{inquiry.contactName}</strong>
                        <span>{inquiry.contactEmail}</span>
                      </div>
                    </td>
                    <td>{formatDate(inquiry.eventDate)}</td>
                    <td>{inquiry.partySize}</td>
                    <td className="truncate">{inquiry.eventLocation}</td>
                    <td><StatusBadge status={inquiry.status} /></td>
                    <td>{formatDate(inquiry.createdAt)}</td>
                    <td>
                      <Link href={`/dashboard/catering/${inquiry.id}`} className="btn-link">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="pagination">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        ) : null}

        <style jsx>{`
          .filters-row {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
          }

          .filter-label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--text-secondary);
          }

          .filter-label select {
            padding: 0.4rem 0.6rem;
            border: 1px solid var(--border);
            border-radius: 0.375rem;
            background: var(--surface);
            color: var(--text-primary);
          }

          .result-count {
            margin-left: auto;
            font-size: 0.875rem;
            color: var(--text-secondary);
          }

          .table-container {
            overflow-x: auto;
            border: 1px solid var(--border);
            border-radius: 0.5rem;
          }

          .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
          }

          .data-table th {
            text-align: left;
            padding: 0.75rem 1rem;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            font-weight: 600;
            color: var(--text-secondary);
          }

          .data-table td {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--border);
          }

          .data-table tr:last-child td {
            border-bottom: none;
          }

          .mono {
            font-family: monospace;
            font-size: 0.8rem;
          }

          .contact-cell {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
          }

          .contact-cell span {
            font-size: 0.8rem;
            color: var(--text-secondary);
          }

          .truncate {
            max-width: 12rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .btn-link {
            color: var(--accent);
            text-decoration: none;
            font-weight: 500;
          }

          .btn-link:hover {
            text-decoration: underline;
          }

          .pagination {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            margin-top: 1.5rem;
          }

          .pagination button {
            padding: 0.4rem 0.8rem;
            border: 1px solid var(--border);
            border-radius: 0.375rem;
            background: var(--surface);
            color: var(--text-primary);
            cursor: pointer;
          }

          .pagination button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .loading-state,
          .empty-state {
            padding: 3rem;
            text-align: center;
            color: var(--text-secondary);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
          }
        `}</style>
      </AnimatedPage>
    </RoleGate>
  );
}
