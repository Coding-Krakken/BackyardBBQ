import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAnyRole, type Role } from '@/lib/roles';
import { StatusBadge } from '@/components/StatusBadge';
import { BookingActions } from '@/components/BookingActions';
import Link from 'next/link';
import { formatCurrency, formatDateShort } from '@/lib/utils';

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/login');
  const role = (session.user as { role?: string })?.role;
  if (!hasAnyRole(role, ['owner', 'admin', 'manager', 'staff'] satisfies Role[])) redirect('/dashboard');

  const booking = await prisma.cateringBooking.findUnique({
    where: { id: params.id },
    include: {
      location: true,
      customer: true,
    },
  });

  if (!booking) return notFound();

  return (
    <div className="page-detail">
      <div className="mb-md">
        <Link href="/dashboard/bookings" className="btn btn-ghost btn-sm">&larr; Back to Bookings</Link>
      </div>

      <div className="page-detail-header mb-lg">
        <div>
          <h2>Booking #{booking.id.slice(0, 8)}</h2>
          <p className="text-muted">Event: {formatDateShort(booking.eventDate)}</p>
        </div>
        <div className="flex-gap-sm">
          <StatusBadge status={booking.status} type="booking" />
          <BookingActions bookingId={booking.id} currentStatus={booking.status} />
        </div>
      </div>

      <div className="grid-cards grid-cards-2 mb-lg">
        <div className="panel">
          <h4 className="mb-md">Event Details</h4>
          <dl className="detail-list">
            <div className="detail-list-item">
              <dt>Event Date</dt>
              <dd>{formatDateShort(booking.eventDate)}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Party Size</dt>
              <dd>{booking.partySize}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Package</dt>
              <dd>{booking.packageName ?? 'Custom'}</dd>
            </div>
            <div className="detail-list-item">
              <dt>Location</dt>
              <dd>{booking.location?.name ?? 'N/A'}</dd>
            </div>
            {booking.estimatedTotalCents != null && (
              <div className="detail-list-item">
                <dt>Estimated Total</dt>
                <dd className="detail-value-highlight">{formatCurrency(booking.estimatedTotalCents)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="panel">
          <h4 className="mb-md">Customer</h4>
          {booking.customer ? (
            <dl className="detail-list">
              <div className="detail-list-item">
                <dt>Name</dt>
                <dd>{[booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(' ') || 'N/A'}</dd>
              </div>
              <div className="detail-list-item">
                <dt>Email</dt>
                <dd>{booking.customer.email}</dd>
              </div>
              <div className="detail-list-item">
                <dt>Phone</dt>
                <dd>{booking.customer.phone ?? 'N/A'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted">No customer linked</p>
          )}
        </div>
      </div>

      {booking.notes && (
        <div className="panel">
          <h4 className="mb-md">Notes</h4>
          <p className="text-body">{booking.notes}</p>
        </div>
      )}
    </div>
  );
}
