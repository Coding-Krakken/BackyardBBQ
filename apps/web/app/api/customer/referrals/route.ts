import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/customer/referrals - Fetch all referrals and stats for the logged-in customer
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch all referrals sent by this customer
    const referrals = await prisma.referral.findMany({
      where: { referrerId: session.user.id },
      include: {
        referee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Calculate stats
    const totalReferrals = referrals.length;
    const signedUpCount = referrals.filter(r => r.status === "signed_up" || r.status === "rewarded").length;
    const rewardedCount = referrals.filter(r => r.status === "rewarded").length;
    const totalEarnedCents = referrals
      .filter(r => r.status === "rewarded")
      .reduce((sum, r) => sum + r.rewardCents, 0);
    const pendingRewardsCents = referrals
      .filter(r => r.status === "rewarded" && !r.rewardClaimed)
      .reduce((sum, r) => sum + r.rewardCents, 0);

    // Get customer's unique referral code
    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        firstName: true
      }
    });

    // Generate referral code from customer ID (first 8 chars) + first name initial
    const referralCode = `${customer?.firstName?.charAt(0).toUpperCase() || ""}${customer?.id.substring(0, 8).toUpperCase()}`;

    return NextResponse.json({
      referrals: referrals.map(r => ({
        id: r.id,
        refereeEmail: r.refereeEmail,
        refereeName: r.referee 
          ? `${r.referee.firstName || ""} ${r.referee.lastName || ""}`.trim() || r.referee.email
          : null,
        status: r.status,
        rewardCents: r.rewardCents,
        rewardClaimed: r.rewardClaimed,
        claimedAt: r.claimedAt,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt
      })),
      stats: {
        totalReferrals,
        signedUpCount,
        rewardedCount,
        totalEarnedCents,
        pendingRewardsCents,
        referralCode
      }
    });
  } catch (error) {
    console.error("Get referrals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch referrals" },
      { status: 500 }
    );
  }
}

// POST /api/customer/referrals - Send a new referral invitation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { refereeEmail } = body;

    if (!refereeEmail || !refereeEmail.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Check if customer is trying to refer themselves
    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id }
    });

    if (customer?.email.toLowerCase() === refereeEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "Cannot refer yourself" },
        { status: 400 }
      );
    }

    // Check if this email was already referred by this customer
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referrerId: session.user.id,
        refereeEmail: refereeEmail.toLowerCase()
      }
    });

    if (existingReferral) {
      return NextResponse.json(
        { error: "You've already referred this email" },
        { status: 400 }
      );
    }

    // Generate unique referral code for this specific invitation
    const baseCode = `${customer?.firstName?.charAt(0).toUpperCase() || "R"}${customer?.id.substring(0, 6).toUpperCase()}`;
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referralCode = `${baseCode}-${randomSuffix}`;

    // Set expiration to 90 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Create referral record
    const referral = await prisma.referral.create({
      data: {
        referrerId: session.user.id,
        refereeEmail: refereeEmail.toLowerCase(),
        referralCode,
        status: "pending",
        rewardCents: 1000, // $10 default reward
        expiresAt
      }
    });

    // TODO: Send referral email via delivery-channels package
    // This would include:
    // - Personalized message from referrer
    // - Signup link with referral code: /auth/signup?ref={referralCode}
    // - Reward details ($10 for referee, $10 for referrer after first order)

    return NextResponse.json({
      referral: {
        id: referral.id,
        refereeEmail: referral.refereeEmail,
        referralCode: referral.referralCode,
        status: referral.status,
        expiresAt: referral.expiresAt
      },
      message: "Referral invitation created successfully"
    });
  } catch (error) {
    console.error("Create referral error:", error);
    return NextResponse.json(
      { error: "Failed to create referral" },
      { status: 500 }
    );
  }
}
