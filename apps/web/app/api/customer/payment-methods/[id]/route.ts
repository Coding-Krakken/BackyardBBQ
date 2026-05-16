import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" })
  : null;

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const method = await prisma.savedPaymentMethod.findFirst({
      where: {
        id,
        customerId: session.user.id,
      },
      select: {
        id: true,
        customerId: true,
        stripePaymentMethodId: true,
        isDefault: true,
      },
    });

    if (!method) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        stripeCustomerId: true,
        defaultPaymentMethodId: true,
      },
    });

    if (stripe && customer?.stripeCustomerId) {
      try {
        await stripe.paymentMethods.detach(method.stripePaymentMethodId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stripe detach failed";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    const wasDefault =
      method.isDefault || customer?.defaultPaymentMethodId === method.stripePaymentMethodId;

    await prisma.$transaction(async (tx) => {
      await tx.savedPaymentMethod.delete({
        where: { id: method.id },
      });

      if (!wasDefault) {
        return;
      }

      const nextDefault = await tx.savedPaymentMethod.findFirst({
        where: { customerId: method.customerId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          stripePaymentMethodId: true,
        },
      });

      await tx.savedPaymentMethod.updateMany({
        where: { customerId: method.customerId },
        data: { isDefault: false },
      });

      if (nextDefault) {
        await tx.savedPaymentMethod.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }

      await tx.customer.update({
        where: { id: method.customerId },
        data: {
          defaultPaymentMethodId: nextDefault?.stripePaymentMethodId ?? null,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete payment method error:", error);
    return NextResponse.json(
      { error: "Failed to remove payment method" },
      { status: 500 }
    );
  }
}
