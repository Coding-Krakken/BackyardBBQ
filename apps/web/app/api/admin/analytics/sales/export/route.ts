import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) return null;
  return session;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "14"), 90);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { notIn: ["cancelled"] } },
    select: { source: true, totalCents: true, createdAt: true }
  });

  const rows = ["date,source,totalCents,totalUSD"];
  for (const o of orders) {
    rows.push([
      o.createdAt.toISOString().slice(0, 10),
      o.source,
      o.totalCents,
      (o.totalCents / 100).toFixed(2)
    ].join(","));
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="sales-${days}d.csv"`
    }
  });
}
