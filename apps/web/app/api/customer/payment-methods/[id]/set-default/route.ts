import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../../lib/auth";
import { getPaymentProvider, unsupportedProviderMessage } from "../../../../../lib/payment-provider";

export async function PATCH(
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
        { error: unsupportedProviderMessage("/api/customer/payment-methods/:id/set-default") },
        { status: 501 }
      );
    }

    const { id } = await context.params;
    return NextResponse.json(
      {
        error: "Payment method preferences are managed at the point of service through our EPOS terminal.",
        paymentMethodId: id,
      },
      { status: 410 }
    );
  } catch (error) {
    console.error("Set default payment method error:", error);
    return NextResponse.json(
      { error: "Failed to update default payment method" },
      { status: 500 }
    );
  }
}
