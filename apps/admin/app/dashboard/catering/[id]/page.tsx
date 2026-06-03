'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { useToast } from '@/components/Toast';
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
  updatedAt: string;
}

const STATUS_OPTIONS = ['pending', 'contacted', 'booked', 'declined', 'cancelled'];

export default function CateringInquiryDetailPage({ params }: { params: { id: string } }) {
  const { data, mutate, isLoading } = useSWR<{ inquiry: CateringInquiry }>(
    `/api/admin/catering/inquiries/${params.id}`,
    fetcher
  );
  const { addToast } = useToast();
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const inquiry = data?.inquiry;

  const handleStatusChange = async (newStatus: string) => {
    if (!inquiry || newStatus === inquiry.status) return;
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/catering/inquiries/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      await mutate();
      addToast({ type: 'success', message: `Status updated to "${newStatus}"` });
    } catch {
      addToast({ type: 'error', message: 'Failed to update inquiry status' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
        <AnimatedPage>
          <div className="loading-state">Loading inquiry...</div>
        </AnimatedPage>
      </RoleGate>
    );
  }

  if (!inquiry) {
    return (
      <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
        <AnimatedPage>
          <div className="empty-state">Inquiry not found.</div>
        </AnimatedPage>
      </RoleGate>
    );
  }

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
      <AnimatedPage>
        <PageHeader
          title={`Inquiry ${inquiry.referenceNumber}`}
          subtitle={`Submitted ${formatDate(inquiry.createdAt)}`}
        />

        <div className="detail-layout">
          <section className="detail-card">
            <div className="card-header">
              <h2>Status</h2>
              <StatusBadge status={inquiry.status} />
            </div>
            <div className="status-update">
              <label>
                Update status:
                <select
                  value={inquiry.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="detail-card">
            <h2>Event Details</h2>
            <dl className="detail-grid">
              <dt>Event Date</dt>
              <dd>{formatDate(inquiry.eventDate)}</dd>
              <dt>Number of Guests</dt>
              <dd>{inquiry.partySize}</dd>
              <dt>Location</dt>
              <dd>{inquiry.eventLocation}</dd>
            </dl>
          </section>

          <section className="detail-card full-width">
            <h2>Food Preferences</h2>
            <p className="detail-text">{inquiry.foodPreferences}</p>
          </section>

          {inquiry.additionalNotes ? (
            <section className="detail-card full-width">
              <h2>Additional Notes</h2>
              <p className="detail-text">{inquiry.additionalNotes}</p>
            </section>
          ) : null}

          <section className="detail-card">
            <h2>Contact Information</h2>
            <dl className="detail-grid">
              <dt>Name</dt>
              <dd>{inquiry.contactName}</dd>
              <dt>Email</dt>
              <dd><a href={`mailto:${inquiry.contactEmail}`}>{inquiry.contactEmail}</a></dd>
              <dt>Phone</dt>
              <dd><a href={`tel:${inquiry.contactPhone}`}>{inquiry.contactPhone}</a></dd>
            </dl>
          </section>

          <section className="detail-card">
            <h2>Metadata</h2>
            <dl className="detail-grid">
              <dt>Reference</dt>
              <dd className="mono">{inquiry.referenceNumber}</dd>
              <dt>Created</dt>
              <dd>{formatDate(inquiry.createdAt)}</dd>
              <dt>Updated</dt>
              <dd>{formatDate(inquiry.updatedAt)}</dd>
            </dl>
          </section>
        </div>

        <div className="back-link">
          <Link href="/dashboard/catering">← Back to Catering Inquiries</Link>
        </div>

        <style jsx>{`
          .detail-layout {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
          }

          .detail-card {
            padding: 1.5rem;
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            background: var(--surface);
          }

          .detail-card.full-width {
            grid-column: 1 / -1;
          }

          .detail-card h2 {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: var(--text-primary);
          }

          .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1rem;
          }

          .card-header h2 {
            margin-bottom: 0;
          }

          .status-update {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .status-update label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--text-secondary);
          }

          .status-update select {
            padding: 0.4rem 0.6rem;
            border: 1px solid var(--border);
            border-radius: 0.375rem;
            background: var(--surface);
            color: var(--text-primary);
          }

          .detail-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 0.5rem 1rem;
            font-size: 0.875rem;
          }

          .detail-grid dt {
            color: var(--text-secondary);
            font-weight: 500;
          }

          .detail-grid dd {
            margin: 0;
            color: var(--text-primary);
          }

          .detail-grid a {
            color: var(--accent);
            text-decoration: none;
          }

          .detail-grid a:hover {
            text-decoration: underline;
          }

          .detail-text {
            color: var(--text-primary);
            white-space: pre-wrap;
            line-height: 1.6;
          }

          .mono {
            font-family: monospace;
            font-size: 0.85rem;
          }

          .back-link {
            margin-top: 1rem;
          }

          .back-link a {
            color: var(--accent);
            text-decoration: none;
            font-size: 0.875rem;
          }

          .back-link a:hover {
            text-decoration: underline;
          }

          .loading-state,
          .empty-state {
            padding: 3rem;
            text-align: center;
            color: var(--text-secondary);
          }

          @media (max-width: 768px) {
            .detail-layout {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </AnimatedPage>
    </RoleGate>
  );
}
