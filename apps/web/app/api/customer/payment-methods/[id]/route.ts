import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { getPaymentProvider, unsupportedProviderMessage } from "../../../../lib/payment-provider";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = getPaymentProvider();
    if (provider !== "epos") {
      return NextResponse.json(
        { error: unsupportedProviderMessage("/api/customer/payment-methods/:id") },
        { status: 501 }
      );
    }

    const { id } = await context.params;
    return NextResponse.json(
      {
        error: "Payment methods are managed directly through the EPOS terminal and cannot be modified here.",
        paymentMethodId: id,
      },
      { status: 410 }
    );
  } catch (error) {
    console.error("Delete payment method error:", error);
    return NextResponse.json(
      { error: "Failed to remove payment method" },
      { status: 500 }
    );
  }
}
