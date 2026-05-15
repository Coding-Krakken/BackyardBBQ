import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Card, Badge } from '@tremor/react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasAnyRole, type Role } from '@/lib/roles';

interface CustomerDetailPageProps {
  params: { id: string };
}

function formatCurrency(cents: number): string {
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
  });
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/login');
  }

  const role = (session.user as { role?: string }).role;
  if (!hasAnyRole(role, ['owner', 'admin', 'manager'] satisfies Role[])) {
    redirect('/dashboard');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { location: { select: { name: true } } },
      },
      bookings: {
        orderBy: { eventDate: 'desc' },
        take: 10,
        include: { location: { select: { name: true } } },
      },
      referralsSent: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unknown';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Customer Detail</p>
          <h1 className="text-3xl font-bold text-bbq-light">{fullName}</h1>
          <p className="mt-1 text-sm text-gray-400">{customer.email}</p>
        </div>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
        >
          Back to Customers
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-400">Role</p>
          <Badge className="mt-2" color="blue">{customer.role}</Badge>
          <p className="mt-4 text-sm text-gray-400">Phone</p>
          <p className="text-bbq-light">{customer.phone || 'No phone on file'}</p>
          <p className="mt-4 text-sm text-gray-400">Joined</p>
          <p className="text-bbq-light">{formatDate(customer.createdAt)}</p>
        </Card>

        <Card>
          <p className="text-sm text-gray-400">Order Snapshot</p>
          <p className="mt-2 text-bbq-light font-semibold">{customer.orders.length} recent orders</p>
          <p className="mt-1 text-sm text-gray-400">
            Total recent spend:{' '}
            {formatCurrency(customer.orders.reduce((sum, order) => sum + order.totalCents, 0))}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-gray-400">Referral Snapshot</p>
          <p className="mt-2 text-bbq-light font-semibold">{customer.referralsSent.length} referrals sent</p>
          <p className="mt-1 text-sm text-gray-400">
            Rewarded:{' '}
            {customer.referralsSent.filter((referral) => referral.status === 'rewarded').length}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold text-bbq-light">Recent Orders</h2>
        <div className="mt-4 space-y-3">
          {customer.orders.length === 0 ? (
            <p className="text-sm text-gray-400">No orders yet.</p>
          ) : (
            customer.orders.map((order) => (
              <div key={order.id} className="rounded-lg border border-gray-800 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-bbq-light font-medium">#{order.id.slice(0, 8)} • {order.source.toUpperCase()}</p>
                  <p className="text-bbq-light font-semibold">{formatCurrency(order.totalCents)}</p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-gray-400">
                  <span>Status: {order.status}</span>
                  <span>Location: {order.location.name}</span>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-bbq-light">Recent Bookings</h2>
        <div className="mt-4 space-y-3">
          {customer.bookings.length === 0 ? (
            <p className="text-sm text-gray-400">No bookings yet.</p>
          ) : (
            customer.bookings.map((booking) => (
              <div key={booking.id} className="rounded-lg border border-gray-800 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-bbq-light font-medium">#{booking.id.slice(0, 8)} • {booking.packageName || 'Custom package'}</p>
                  <p className="text-bbq-light font-semibold">{booking.partySize} guests</p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-gray-400">
                  <span>Status: {booking.status}</span>
                  <span>Location: {booking.location.name}</span>
                  <span>{formatDate(booking.eventDate)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-bbq-light">Referral Activity</h2>
        <div className="mt-4 space-y-3">
          {customer.referralsSent.length === 0 ? (
            <p className="text-sm text-gray-400">No referral activity yet.</p>
          ) : (
            customer.referralsSent.map((referral) => (
              <div key={referral.id} className="rounded-lg border border-gray-800 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-bbq-light font-medium">Code: {referral.referralCode}</p>
                  <Badge color={referral.status === 'rewarded' ? 'green' : referral.status === 'expired' ? 'red' : 'yellow'}>
                    {referral.status}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-gray-400">
                  <span>Referee: {referral.refereeEmail || 'N/A'}</span>
                  <span>Reward: {formatCurrency(referral.rewardCents)}</span>
                  <span>{formatDate(referral.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
