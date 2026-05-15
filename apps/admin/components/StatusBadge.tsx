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

export function StatusBadge({ status }: StatusBadgeProps) {
  const getVariant = (): string => {
    // Success states
    if (['completed', 'approved', 'succeeded', 'rewarded'].includes(status)) return 'badge-success';
    // Active/processing states
    if (['confirmed', 'preparing', 'processing'].includes(status)) return 'badge-info';
    // Ready / attention states
    if (['ready'].includes(status)) return 'badge-ember';
    // Pending states
    if (['pending', 'pending_approval', 'draft'].includes(status) || status.startsWith('requires_')) return 'badge-warning';
    // Cancelled / failed states
    if (['cancelled', 'canceled', 'declined', 'failed', 'expired'].includes(status)) return 'badge-danger';
    // Refund states
    if (['partially_refunded', 'refunded'].includes(status)) return 'badge-brass';
    return 'badge-default';
  };

  const formatStatus = (): string => {
    return status
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <span className={`badge ${getVariant()}`}>
      {formatStatus()}
    </span>
  );
}
