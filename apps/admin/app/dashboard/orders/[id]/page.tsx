import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Card, Badge } from '@tremor/react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasAnyRole, type Role } from '@/lib/roles';

interface OrderDetailPageProps {
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
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/login');
  }

  const role = (session.user as { role?: string }).role;
  if (!hasAnyRole(role, ['owner', 'admin', 'manager', 'staff'] satisfies Role[])) {
    redirect('/dashboard');
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      location: { select: { name: true, timezone: true } },
      customer: {
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      },
      items: {
        select: { id: true, menuItemName: true, quantity: true, unitPriceCents: true, notes: true },
      },
      payment: {
        select: {
          stripePaymentIntentId: true,
          amountCents: true,
          currency: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Order Detail</p>
          <h1 className="text-3xl font-bold text-bbq-light">Order #{order.id.slice(0, 8)}</h1>
        </div>
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
        >
          Back to Orders
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-400">Status</p>
          <Badge className="mt-2" color="blue">{order.status}</Badge>
          <p className="mt-4 text-sm text-gray-400">Source</p>
          <p className="text-bbq-light font-medium">{order.source.toUpperCase()}</p>
          <p className="mt-4 text-sm text-gray-400">Created</p>
          <p className="text-bbq-light">{formatDate(order.createdAt)}</p>
        </Card>

        <Card>
          <p className="text-sm text-gray-400">Financials</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>{formatCurrency(order.subtotalCents)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Tax</span><span>{formatCurrency(order.taxCents)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Tip</span><span>{formatCurrency(order.tipCents)}</span></div>
            <div className="flex justify-between border-t border-gray-800 pt-2 font-semibold"><span>Total</span><span>{formatCurrency(order.totalCents)}</span></div>
          </div>
        </Card>

        <Card>
          <p className="text-sm text-gray-400">Customer</p>
          {order.customer ? (
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-bbq-light font-medium">
                {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') || 'Unknown'}
              </p>
              <p className="text-gray-300">{order.customer.email}</p>
              <p className="text-gray-400">{order.customer.phone || 'No phone on file'}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400">Guest checkout</p>
          )}

          <p className="mt-4 text-sm text-gray-400">Location</p>
          <p className="text-bbq-light font-medium">{order.location.name}</p>
          <p className="text-gray-400 text-sm">{order.location.timezone}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold text-bbq-light">Order Items</h2>
        <div className="mt-4 space-y-3">
          {order.items.length === 0 ? (
            <p className="text-sm text-gray-400">No order items found.</p>
          ) : (
            order.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-800 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-bbq-light font-medium">{item.menuItemName}</p>
                  <p className="text-sm text-gray-300">x{item.quantity}</p>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <p className="text-gray-400">Unit price: {formatCurrency(item.unitPriceCents)}</p>
                  <p className="font-medium text-bbq-light">Line total: {formatCurrency(item.unitPriceCents * item.quantity)}</p>
                </div>
                {item.notes && <p className="mt-2 text-sm text-gray-400">Notes: {item.notes}</p>}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-bbq-light">Payment</h2>
        {order.payment ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <p className="text-gray-400">Payment Intent</p>
              <p className="text-bbq-light font-medium break-all">{order.payment.stripePaymentIntentId}</p>
            </div>
            <div>
              <p className="text-gray-400">Status</p>
              <p className="text-bbq-light font-medium">{order.payment.status}</p>
            </div>
            <div>
              <p className="text-gray-400">Amount</p>
              <p className="text-bbq-light font-medium">{formatCurrency(order.payment.amountCents)}</p>
            </div>
            <div>
              <p className="text-gray-400">Created</p>
              <p className="text-bbq-light font-medium">{formatDate(order.payment.createdAt)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-400">No payment record linked to this order yet.</p>
        )}
      </Card>
    </div>
  );
}
