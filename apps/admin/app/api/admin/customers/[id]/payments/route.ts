import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "manager", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const { searchParams } = new URL(request.url);

  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);
  const status = searchParams.get("status")?.trim();
  const paymentType = searchParams.get("paymentType")?.trim();
  const q = searchParams.get("q")?.trim();

  const startDate = parseDate(searchParams.get("startDate"));
  const endDate = parseDate(searchParams.get("endDate"));

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ message: "Customer not found" }, { status: 404 });
  }

  const where = {
    customerId: id,
    ...(status ? { status: status as never } : {}),
    ...(paymentType ? { paymentType } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" as const } },
            { stripePaymentIntentId: { contains: q, mode: "insensitive" as const } },
            { orderId: { contains: q, mode: "insensitive" as const } },
            { bookingId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  const [payments, allCustomerPayments, disputeEvents] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        stripePaymentIntentId: true,
        orderId: true,
        bookingId: true,
        paymentType: true,
        status: true,
        amountCents: true,
        currency: true,
        createdAt: true,
      },
    }),
    prisma.paymentTransaction.findMany({
      where: { customerId: id },
      select: {
        stripePaymentIntentId: true,
        status: true,
        amountCents: true,
      },
    }),
    prisma.integrationEvent.findMany({
      where: {
        channel: "stripe",
        eventType: { contains: "charge.dispute" },
      },
      select: {
        payload: true,
      },
    }),
  ]);

  const intentIds = new Set(allCustomerPayments.map((payment) => payment.stripePaymentIntentId));

  const disputeIntentIds = new Set<string>();
  for (const event of disputeEvents) {
    const payload = event.payload as Record<string, unknown>;
    const paymentIntentId =
      typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null;
    if (paymentIntentId && intentIds.has(paymentIntentId)) {
      disputeIntentIds.add(paymentIntentId);
    }
  }

  const totalSpentCents = allCustomerPayments.reduce((sum, payment) => {
    if (payment.status === "succeeded") {
      return sum + payment.amountCents;
    }
    return sum;
  }, 0);

  const refundsCents = allCustomerPayments.reduce((sum, payment) => {
    if (payment.status === "refunded" || payment.status === "partially_refunded") {
      return sum + payment.amountCents;
    }
    return sum;
  }, 0);

  const data = payments.map((payment) => ({
    id: payment.id,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    orderId: payment.orderId,
    bookingId: payment.bookingId,
    paymentType: payment.paymentType,
    status: payment.status,
    amountCents: payment.amountCents,
    currency: payment.currency,
    createdAt: payment.createdAt.toISOString(),
  }));

  return NextResponse.json({
    data,
    aggregates: {
      totalSpentCents,
      refundsCents,
      disputeCount: disputeIntentIds.size,
      totalTransactions: allCustomerPayments.length,
    },
  });
}
