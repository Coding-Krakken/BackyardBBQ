import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

function inferProvider(paymentReference: string): "stripe" | "epos" {
  return paymentReference.startsWith("epos_txn_") ? "epos" : "stripe";
}

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
        orderId: true,
        bookingId: true,
        status: true,
        amountCents: true,
      },
    }),
    prisma.integrationEvent.findMany({
      where: {
        OR: [
          {
            channel: "stripe",
            eventType: { contains: "charge.dispute" },
          },
          {
            channel: "epos",
            eventType: { contains: "dispute" },
          },
          {
            channel: "admin",
            eventType: { contains: "dispute" },
          },
        ],
      },
      select: {
        id: true,
        payload: true,
      },
    }),
  ]);

  const paymentReferenceKeys = new Set<string>();
  for (const payment of allCustomerPayments) {
    paymentReferenceKeys.add(payment.stripePaymentIntentId);
    if (payment.stripePaymentIntentId.startsWith("epos_txn_")) {
      paymentReferenceKeys.add(payment.stripePaymentIntentId.slice("epos_txn_".length));
    }
    if (payment.orderId) {
      paymentReferenceKeys.add(payment.orderId);
    }
    if (payment.bookingId) {
      paymentReferenceKeys.add(`booking:${payment.bookingId}`);
    }
  }

  const disputeIds = new Set<string>();
  for (const event of disputeEvents) {
    const payload = event.payload as Record<string, unknown>;

    const candidateReferences = [
      typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null,
      typeof payload.stripePaymentIntentId === "string" ? payload.stripePaymentIntentId : null,
      typeof payload.transactionReferenceCode === "string" ? payload.transactionReferenceCode : null,
      typeof payload.referenceCode === "string" ? payload.referenceCode : null,
      typeof payload.eposTransactionId === "string" ? payload.eposTransactionId : null,
    ].filter((value): value is string => Boolean(value));

    const matchesCustomerPayment = candidateReferences.some((reference) =>
      paymentReferenceKeys.has(reference)
    );

    if (matchesCustomerPayment) {
      const disputeId = typeof payload.disputeId === "string" ? payload.disputeId : event.id;
      disputeIds.add(disputeId);
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
    provider: inferProvider(payment.stripePaymentIntentId),
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
      disputeCount: disputeIds.size,
      totalTransactions: allCustomerPayments.length,
    },
  });
}
