import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      customerId: session.user.id,
      ...(status ? { status } : {})
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: where as any,
        include: {
          items: true,
          location: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          payment: {
            select: {
              status: true,
              amountCents: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: limit,
        skip: offset
      }),
      prisma.order.count({ where: where as any })
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error("Get orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
