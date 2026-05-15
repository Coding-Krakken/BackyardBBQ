import { Badge } from '@tremor/react';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type BookingStatus = 'draft' | 'pending_approval' | 'approved' | 'declined' | 'cancelled';
type PaymentStatus = 
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'requires_capture'
  | 'processing'
  | 'succeeded'
  | 'canceled'
  | 'failed'
  | 'partially_refunded'
  | 'refunded';

interface StatusBadgeProps {
  status: OrderStatus | BookingStatus | PaymentStatus | string;
  type?: 'order' | 'booking' | 'payment';
}

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const getColor = () => {
    // Order statuses
    if (status === 'pending') return 'yellow';
    if (status === 'confirmed') return 'blue';
    if (status === 'preparing') return 'indigo';
    if (status === 'ready') return 'green';
    if (status === 'completed') return 'emerald';
    if (status === 'cancelled') return 'red';

    // Booking statuses
    if (status === 'draft') return 'gray';
    if (status === 'pending_approval') return 'yellow';
    if (status === 'approved') return 'green';
    if (status === 'declined') return 'red';

    // Payment statuses
    if (status === 'succeeded') return 'green';
    if (status === 'processing') return 'blue';
    if (status === 'failed' || status === 'canceled') return 'red';
    if (status === 'partially_refunded' || status === 'refunded') return 'orange';
    if (status.startsWith('requires_')) return 'yellow';

    return 'gray';
  };

  const formatStatus = () => {
    return status
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Badge color={getColor()} size="sm">
      {formatStatus()}
    </Badge>
  );
}
