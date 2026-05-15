import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'accounting']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const dayStart = new Date(`${dateParam}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateParam}T23:59:59.999Z`);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: dayStart, lte: dayEnd }, status: { notIn: ["cancelled"] } },
    select: { id: true, source: true, status: true, totalCents: true, createdAt: true }
  });

  const rows = ["id,source,status,totalCents,totalUSD,createdAt"];
  for (const o of orders) {
    rows.push([
      o.id,
      o.source,
      o.status,
      o.totalCents,
      (o.totalCents / 100).toFixed(2),
      o.createdAt.toISOString()
    ].join(","));
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="daily-close-${dateParam}.csv"`
    }
  });
}
