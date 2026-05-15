import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "../../../../lib/prisma";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  referralCode: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = signupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, phone, referralCode } = validation.data;

    // Check if user already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName: lastName || null,
        phone: phone || null,
        emailVerified: false,
        notificationSettings: {
          email: {
            orderUpdates: true,
            bookingReminders: true,
            promotions: true
          },
          sms: {
            orderUpdates: false,
            bookingReminders: false
          }
        }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    // Handle referral tracking if referral code provided
    if (referralCode) {
      try {
        // Find referral by code and update with new customer
        const referral = await prisma.referral.findFirst({
          where: {
            referralCode: referralCode.toUpperCase(),
            status: "pending",
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } }
            ]
          }
        });

        if (referral) {
          // Update referral status to signed_up and link to new customer
          await prisma.referral.update({
            where: { id: referral.id },
            data: {
              refereeId: customer.id,
              refereeEmail: customer.email,
              status: "signed_up"
            }
          });

          // Create notification for referrer
          await prisma.notification.create({
            data: {
              customerId: referral.referrerId,
              type: "referral_reward",
              title: "Referral Signed Up! 🎉",
              message: `${customer.firstName || "Someone"} just signed up using your referral! You'll earn $10 after their first order.`,
              actionUrl: "/dashboard/referrals"
            }
          });
        }
      } catch (error) {
        console.error("Referral tracking error:", error);
        // Don't fail signup if referral tracking fails
      }
    }

    return NextResponse.json(
      { success: true, customer },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
