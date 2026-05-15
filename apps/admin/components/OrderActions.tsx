'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'] as const;

interface OrderActionsProps {
  orderId: string;
  currentStatus: string;
}

export function OrderActions({ orderId, currentStatus }: OrderActionsProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
      });
      if (res.ok) {
        addToast({ type: 'success', message: `Order updated to ${selectedStatus}` });
        router.refresh();
      } else {
        addToast({ type: 'error', message: 'Failed to update order status' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="flex-gap-sm">
      <select
        className="select"
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
        style={{ minWidth: '140px' }}
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
      <button
        className="btn btn-primary btn-sm"
        disabled={selectedStatus === currentStatus}
        onClick={() => setShowConfirm(true)}
      >
        Update Status
      </button>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleUpdate}
        title="Update Order Status"
        message={`Change order status from "${currentStatus}" to "${selectedStatus}"?`}
        confirmText="Update"
        variant="primary"
        isLoading={isLoading}
      />
    </div>
  );
}
