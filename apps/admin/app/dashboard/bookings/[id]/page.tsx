import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Card, Badge } from '@tremor/react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasAnyRole, type Role } from '@/lib/roles';

interface BookingDetailPageProps {
  params: { id: string };
}

function formatCurrency(cents: number | null | undefined): string {
  if (!cents) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/login');
  }

  const role = (session.user as { role?: string }).role;
  if (!hasAnyRole(role, ['owner', 'admin', 'manager', 'staff'] satisfies Role[])) {
    redirect('/dashboard');
  }

  const booking = await prisma.cateringBooking.findUnique({
    where: { id: params.id },
    include: {
      location: { select: { name: true, timezone: true } },
      customer: {
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      },
    },
  });

  if (!booking) {
    notFound();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Booking Detail</p>
          <h1 className="text-3xl font-bold text-bbq-light">Booking #{booking.id.slice(0, 8)}</h1>
        </div>
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
        >
          Back to Bookings
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-400">Booking Status</p>
          <Badge className="mt-2" color="blue">{booking.status}</Badge>
          <p className="mt-4 text-sm text-gray-400">Event Date</p>
          <p className="text-bbq-light font-medium">{formatDate(booking.eventDate)}</p>
          <p className="mt-4 text-sm text-gray-400">Party Size</p>
          <p className="text-bbq-light font-medium">{booking.partySize} guests</p>
        </Card>

        <Card>
          <p className="text-sm text-gray-400">Package & Venue</p>
          <p className="mt-2 text-bbq-light font-medium">{booking.packageName || 'Custom package'}</p>
          <p className="mt-4 text-sm text-gray-400">Location</p>
          <p className="text-bbq-light font-medium">{booking.location.name}</p>
          <p className="text-sm text-gray-400">{booking.location.timezone}</p>
          {booking.eventAddress && (
            <>
              <p className="mt-4 text-sm text-gray-400">Event Address</p>
              <p className="text-bbq-light text-sm">{booking.eventAddress}</p>
            </>
          )}
        </Card>

        <Card>
          <p className="text-sm text-gray-400">Customer</p>
          {booking.customer ? (
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-bbq-light font-medium">
                {[booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(' ') || 'Unknown'}
              </p>
              <p className="text-gray-300">{booking.customer.email}</p>
              <p className="text-gray-400">{booking.customer.phone || 'No phone on file'}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400">No linked customer account.</p>
          )}

          <p className="mt-4 text-sm text-gray-400">Created</p>
          <p className="text-bbq-light text-sm">{formatDate(booking.createdAt)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold text-bbq-light">Pricing & Payment</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-gray-400">Estimated Total</p>
            <p className="text-bbq-light font-medium">{formatCurrency(booking.estimatedTotalCents)}</p>
          </div>
          <div>
            <p className="text-gray-400">Deposit</p>
            <p className="text-bbq-light font-medium">{formatCurrency(booking.depositCents)}</p>
          </div>
          <div>
            <p className="text-gray-400">Final Payment</p>
            <p className="text-bbq-light font-medium">{formatCurrency(booking.finalPaymentCents)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-bbq-light">Notes</h2>
        <p className="mt-4 text-sm text-gray-300">{booking.notes || 'No notes added for this booking.'}</p>
      </Card>
    </div>
  );
}
