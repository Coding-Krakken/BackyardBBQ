import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { z } from "zod";
import { checkRateLimit, getClientIdentifier } from "../../../../lib/rateLimit";

const ticketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  orderId: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000)
});

// POST /api/support/ticket - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 tickets per 15 minutes per IP
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit({
      identifier: `support-ticket:${clientId}`,
      maxRequests: 5,
      windowMs: 15 * 60 * 1000 // 15 minutes
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many support tickets. Please try again later." },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString()
          }
        }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = ticketSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { subject, orderId, message } = validation.data;

    // Get customer details
    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Verify order belongs to customer if orderId provided
    if (orderId) {
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          customerId: customer.id
        }
      });

      if (!order) {
        return NextResponse.json(
          { error: "Order not found or does not belong to you" },
          { status: 404 }
        );
      }
    }

    // Create notification record for tracking
    const notification = await prisma.notification.create({
      data: {
        customerId: customer.id,
        type: "promotional", // Using promotional as generic type for support tickets
        title: `Support Ticket: ${subject}`,
        message: message.substring(0, 200), // Store preview
        metadata: {
          ticketType: "support",
          subject,
          orderId: orderId || null,
          fullMessage: message,
          status: "open",
          createdAt: new Date().toISOString()
        }
      }
    });

    // TODO: Send email notification to support team via delivery-channels package
    // This would include:
    // - Customer details (name, email, phone)
    // - Subject and message
    // - Order ID if provided
    // - Link to customer profile in admin dashboard

    // TODO: Send confirmation email to customer
    // - Thank you message
    // - Ticket reference number
    // - Expected response time (24 hours)

    return NextResponse.json({
      success: true,
      ticketId: notification.id,
      message: "Support ticket submitted successfully"
    });
  } catch (error) {
    console.error("Create support ticket error:", error);
    return NextResponse.json(
      { error: "Failed to submit support ticket" },
      { status: 500 }
    );
  }
}
