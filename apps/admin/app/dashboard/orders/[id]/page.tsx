import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAnyRole, type Role } from '@/lib/roles';
import { StatusBadge } from '@/components/StatusBadge';
import { OrderActions } from '@/components/OrderActions';
import Link from 'next/link';
import { formatCurrency, formatDateLong } from '@/lib/utils';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/login');
  const role = (session.user as { role?: string })?.role;
  if (!hasAnyRole(role, ['owner', 'admin', 'manager', 'staff'] satisfies Role[])) redirect('/dashboard');

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      payment: true,
      location: true,
    },
  });

  if (!order) return notFound();

  return (
    <div className="page-detail">
      <div className="mb-md">
        <Link href="/dashboard/orders" className="btn btn-ghost btn-sm">&larr; Back to Orders</Link>
      </div>

      <div className="page-detail-header mb-lg">
        <div>
          <h2>Order #{order.id.slice(0, 8)}</h2>
          <p className="text-muted">{formatDateLong(order.createdAt)}</p>
        </div>
        <div className="flex-gap-sm">
          <StatusBadge status={order.status} />
          <OrderActions orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      <div className="grid-cards grid-cards-2 mb-lg">
        <div className="panel">
          <h4 className="mb-md">Summary</h4>
          <dl className="detail-list">
            <div className="detail-list-item">
              <dt>Source</dt>
              <dd>{order.source.toUpperCase()}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Location</dt>
              <dd>{order.location?.name ?? 'N/A'}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Subtotal</dt>
              <dd>{formatCurrency(order.subtotalCents)}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Tax</dt>
              <dd>{formatCurrency(order.taxCents)}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Total</dt>
              <dd className="detail-value-highlight">{formatCurrency(order.totalCents)}</dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h4 className="mb-md">Payment</h4>
          {order.payment ? (
            <dl className="detail-list">
              <div className="detail-list-item">
                <dt>Status</dt>
                <dd><StatusBadge status={order.payment.status} type="payment" /></dd>
              </div>
              <div className="detail-list-item">
                <dt>Currency</dt>
                <dd>{order.payment.currency.toUpperCase()}</dd>
              </div>
              <div className="detail-list-item">
                <dt>Amount</dt>
                <dd>{formatCurrency(order.payment.amountCents)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted">No payment recorded</p>
          )}
        </div>
      </div>

      <div className="panel">
        <h4 className="mb-md">Items</h4>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item: { id: string; menuItemName: string; quantity: number; unitPriceCents: number }) => (
              <tr key={item.id}>
                <td>{item.menuItemName}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.unitPriceCents)}</td>
                <td>{formatCurrency(item.quantity * item.unitPriceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
