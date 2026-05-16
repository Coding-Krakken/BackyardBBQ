import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";

export async function PATCH(
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
      },
    });

    if (!method) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.savedPaymentMethod.updateMany({
        where: { customerId: method.customerId },
        data: { isDefault: false },
      });

      await tx.savedPaymentMethod.update({
        where: { id: method.id },
        data: { isDefault: true },
      });

      await tx.customer.update({
        where: { id: method.customerId },
        data: { defaultPaymentMethodId: method.stripePaymentMethodId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set default payment method error:", error);
    return NextResponse.json(
      { error: "Failed to update default payment method" },
      { status: 500 }
    );
  }
}
