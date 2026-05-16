import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id },
      select: {
        defaultPaymentMethodId: true,
        savedPaymentMethods: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            stripePaymentMethodId: true,
            brand: true,
            last4: true,
            expMonth: true,
            expYear: true,
            isDefault: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      paymentMethods: customer?.savedPaymentMethods ?? [],
      defaultPaymentMethodId: customer?.defaultPaymentMethodId ?? null,
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 }
    );
  }
}
