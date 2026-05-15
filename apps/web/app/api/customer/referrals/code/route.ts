import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/customer/referrals/code - Get customer's unique referral code
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        firstName: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Generate referral code from customer ID + first name initial
    const referralCode = `${customer.firstName?.charAt(0).toUpperCase() || "R"}${customer.id.substring(0, 8).toUpperCase()}`;
    
    // Generate shareable link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const referralLink = `${baseUrl}/auth/signup?ref=${referralCode}`;

    return NextResponse.json({
      referralCode,
      referralLink,
      customer: {
        firstName: customer.firstName,
        email: customer.email
      }
    });
  } catch (error) {
    console.error("Get referral code error:", error);
    return NextResponse.json(
      { error: "Failed to fetch referral code" },
      { status: 500 }
    );
  }
}
