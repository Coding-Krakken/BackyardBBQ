import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { checkRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
const GUEST_TRACK_RATE_LIMIT = 30;
const GUEST_TRACK_WINDOW_MS = 60 * 1000;

function getRequestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const include = {
      items: true,
      location: {
        select: {
          id: true,
          name: true,
          type: true
        }
      },
      payment: {
        select: {
          status: true,
          amountCents: true
        }
      }
    } as const;

    if (!session?.user?.id) {
      if (!sessionId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const ip = getRequestIp(request);
      const rateCheck = checkRateLimit({
        key: `guest-track:${ip}`,
        limit: GUEST_TRACK_RATE_LIMIT,
        windowMs: GUEST_TRACK_WINDOW_MS,
      });

      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: "Too many tracking requests. Please wait and try again." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }

      const stripe = getStripeClient();
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

      const isCompleted = checkoutSession.status === "complete";
      const isPaid = checkoutSession.payment_status === "paid";
      const isWebCheckoutSource =
        typeof checkoutSession.metadata?.source === "string"
          ? checkoutSession.metadata.source === "web-checkout"
          : true;

      if (!isCompleted || !isPaid || !isWebCheckoutSource) {
        return NextResponse.json({ orders: [], pagination: { total: 0, limit, offset, hasMore: false } });
      }

      let resolvedOrderId =
        typeof checkoutSession.metadata?.orderId === "string" && checkoutSession.metadata.orderId
          ? checkoutSession.metadata.orderId
          : undefined;

      const paymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : undefined;

      if (!resolvedOrderId && paymentIntentId) {
        const linkedPayment = await prisma.paymentTransaction.findUnique({
          where: { stripePaymentIntentId: paymentIntentId },
          select: { orderId: true }
        });
        resolvedOrderId = linkedPayment?.orderId ?? undefined;
      }

      if (!resolvedOrderId) {
        return NextResponse.json({ orders: [], pagination: { total: 0, limit, offset, hasMore: false } });
      }

      const guestOrder = await prisma.order.findUnique({
        where: { id: resolvedOrderId },
        include
      });

      if (!guestOrder || (status && guestOrder.status !== status)) {
        return NextResponse.json({ orders: [], pagination: { total: 0, limit, offset, hasMore: false } });
      }

      return NextResponse.json({
        orders: [guestOrder],
        pagination: {
          total: 1,
          limit,
          offset,
          hasMore: false
        },
        guestTracking: true
      });
    }

    const where = {
      customerId: session.user.id,
      ...(status ? { status } : {})
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: where as any,
        include,
        orderBy: {
          createdAt: "desc"
        },
        take: limit,
        skip: offset
      }),
      prisma.order.count({ where: where as any })
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error("Get orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
