import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAnyRole, type Role } from '@/lib/roles';
import { StatusBadge } from '@/components/StatusBadge';
import { CustomerPaymentHistory } from '@/components/CustomerPaymentHistory';
import Link from 'next/link';
import { formatCurrency, formatDateShort } from '@/lib/utils';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/login');
  const role = (session.user as { role?: string })?.role;
  if (!hasAnyRole(role, ['owner', 'admin', 'manager'] satisfies Role[])) redirect('/dashboard');

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      orders: { take: 10, orderBy: { createdAt: 'desc' } },
      bookings: { take: 10, orderBy: { createdAt: 'desc' } },
      referralsSent: { take: 10 },
    },
  });

  if (!customer) return notFound();

  return (
    <div className="page-detail">
      <div className="mb-md">
        <Link href="/dashboard/customers" className="btn btn-ghost btn-sm">&larr; Back to Customers</Link>
      </div>

      <div className="page-detail-header mb-lg">
        <div>
          <h2>{[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unknown Customer'}</h2>
          <p className="text-muted">{customer.email}</p>
        </div>
      </div>

      <div className="grid-cards grid-cards-2 mb-lg">
        <div className="panel">
          <h4 className="mb-md">Contact</h4>
          <dl className="detail-list">
            <div className="detail-list-item">
              <dt>Email</dt>
              <dd>{customer.email}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Phone</dt>
              <dd>{customer.phone ?? 'N/A'}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Customer Since</dt>
              <dd>{formatDateShort(customer.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h4 className="mb-md">Summary</h4>
          <dl className="detail-list">
            <div className="detail-list-item">
              <dt>Total Orders</dt>
              <dd>{customer.orders.length}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Total Bookings</dt>
              <dd>{customer.bookings.length}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Referrals</dt>
              <dd>{customer.referralsSent.length}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="panel mb-lg">
        <h4 className="mb-md">Recent Orders</h4>
        {customer.orders.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Status</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((order: { id: string; status: string; totalCents: number; createdAt: Date }) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/dashboard/orders/${order.id}`} className="link-ember">
                      {order.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>{formatCurrency(order.totalCents)}</td>
                  <td>{formatDateShort(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">No orders yet</p>
        )}
      </div>

      {/* Recent Bookings */}
      <div className="panel mb-lg">
        <h4 className="mb-md">Recent Bookings</h4>
        {customer.bookings.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Status</th>
                <th>Event Date</th>
                <th>Party Size</th>
              </tr>
            </thead>
            <tbody>
              {customer.bookings.map((booking: { id: string; status: string; eventDate: Date; partySize: number }) => (
                <tr key={booking.id}>
                  <td>
                    <Link href={`/dashboard/bookings/${booking.id}`} className="link-ember">
                      {booking.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td><StatusBadge status={booking.status} type="booking" /></td>
                  <td>{formatDateShort(booking.eventDate)}</td>
                  <td>{booking.partySize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">No bookings yet</p>
        )}
      </div>

      {/* Referrals */}
      {customer.referralsSent.length > 0 && (
        <div className="panel">
          <h4 className="mb-md">Referrals</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Referral ID</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {customer.referralsSent.map((referral: { id: string; status: string; createdAt: Date }) => (
                <tr key={referral.id}>
                  <td>{referral.id.slice(0, 8)}</td>
                  <td><StatusBadge status={referral.status} /></td>
                  <td>{formatDateShort(referral.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-lg">
        <CustomerPaymentHistory customerId={customer.id} />
      </div>
    </div>
  );
}
