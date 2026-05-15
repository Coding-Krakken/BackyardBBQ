'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

interface BookingActionsProps {
  bookingId: string;
  currentStatus: string;
}

export function BookingActions({ bookingId, currentStatus }: BookingActionsProps) {
  const [action, setAction] = useState<'approve' | 'decline' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();

  const handleAction = async () => {
    if (!action) return;
    setIsLoading(true);
    try {
      const newStatus = action === 'approve' ? 'confirmed' : 'cancelled';
      const res = await fetch(`/api/admin/catering/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        addToast({ type: 'success', message: `Booking ${action === 'approve' ? 'approved' : 'declined'}` });
        router.refresh();
      } else {
        addToast({ type: 'error', message: 'Failed to update booking' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsLoading(false);
      setAction(null);
    }
  };

  const isPending = currentStatus === 'pending';

  if (!isPending) return null;

  return (
    <div className="flex-gap-sm">
      <button className="btn btn-primary btn-sm" onClick={() => setAction('approve')}>
        Approve
      </button>
      <button className="btn btn-danger btn-sm" onClick={() => setAction('decline')}>
        Decline
      </button>

      <ConfirmDialog
        isOpen={action !== null}
        onClose={() => setAction(null)}
        onConfirm={handleAction}
        title={action === 'approve' ? 'Approve Booking' : 'Decline Booking'}
        message={
          action === 'approve'
            ? 'Are you sure you want to approve this booking? The customer will be notified.'
            : 'Are you sure you want to decline this booking? This action cannot be undone.'
        }
        confirmText={action === 'approve' ? 'Approve' : 'Decline'}
        variant={action === 'approve' ? 'primary' : 'destructive'}
        isLoading={isLoading}
      />
    </div>
  );
}
