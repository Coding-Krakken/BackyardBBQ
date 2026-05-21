import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { getPaymentProvider } from "../../../lib/payment-provider";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = getPaymentProvider();
    if (provider === "epos") {
      return NextResponse.json(
        { error: "Customer billing portal is unavailable with EPOS payment processing." },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { error: "Payment provider not supported" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Create portal session error:", error);
    return NextResponse.json(
      { error: "Failed to create customer portal session" },
      { status: 500 }
    );
  }
}
