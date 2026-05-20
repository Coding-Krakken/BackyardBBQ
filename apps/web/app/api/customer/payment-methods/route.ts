import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { getPaymentProvider } from "../../../lib/payment-provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = getPaymentProvider();

    if (provider !== "epos") {
      return NextResponse.json(
        {
          error: "Configured payment provider is unsupported for this endpoint.",
        },
        { status: 501 }
      );
    }

    return NextResponse.json({
      paymentMethods: [],
      defaultPaymentMethodId: null,
      provider,
      capability: "unavailable",
      message: "Saved payment methods are not available. Payments are processed directly through our EPOS terminal.",
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 }
    );
  }
}
