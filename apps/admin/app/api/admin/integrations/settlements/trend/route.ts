import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const deliveryChannels = ["doordash", "ubereats", "grubhub"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days") ?? "14");
  const channelParam = searchParams.get("channel");
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.trunc(daysParam), 1), 90) : 14;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: Prisma.IntegrationEventWhereInput = {
    channel: { in: [...deliveryChannels] },
    eventType: { contains: "settlement" },
    status: "processed",
    createdAt: { gte: since }
  };

  if (channelParam && deliveryChannels.includes(channelParam as (typeof deliveryChannels)[number])) {
    where.channel = channelParam;
  }

  const events = await prisma.integrationEvent.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      channel: true,
      createdAt: true,
      payload: true
    }
  });

  const byDayMap = new Map<
    string,
    {
      grossCents: number;
      feesCents: number;
      netCents: number;
      count: number;
      channels: Record<string, { grossCents: number; feesCents: number; netCents: number; count: number }>;
    }
  >();

  for (const event of events) {
    const day = event.createdAt.toISOString().slice(0, 10);
    const payload = event.payload as Record<string, unknown>;
    const settlementPayload =
      payload.settlement && typeof payload.settlement === "object"
        ? (payload.settlement as Record<string, unknown>)
        : payload;

    const grossCents = typeof settlementPayload.grossCents === "number" ? settlementPayload.grossCents : 0;
    const feesCents = typeof settlementPayload.feesCents === "number" ? settlementPayload.feesCents : 0;
    const netCents = typeof settlementPayload.netCents === "number" ? settlementPayload.netCents : 0;

    if (!byDayMap.has(day)) {
      byDayMap.set(day, {
        grossCents: 0,
        feesCents: 0,
        netCents: 0,
        count: 0,
        channels: {}
      });
    }

    const dayTotals = byDayMap.get(day)!;
    dayTotals.grossCents += grossCents;
    dayTotals.feesCents += feesCents;
    dayTotals.netCents += netCents;
    dayTotals.count += 1;

    if (!dayTotals.channels[event.channel]) {
      dayTotals.channels[event.channel] = { grossCents: 0, feesCents: 0, netCents: 0, count: 0 };
    }
    const channelTotals = dayTotals.channels[event.channel]!;
    channelTotals.grossCents += grossCents;
    channelTotals.feesCents += feesCents;
    channelTotals.netCents += netCents;
    channelTotals.count += 1;
  }

  const data = Array.from(byDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totals]) => ({
      date,
      grossCents: totals.grossCents,
      feesCents: totals.feesCents,
      netCents: totals.netCents,
      count: totals.count,
      feeRatePercent: totals.grossCents > 0 ? Number(((totals.feesCents / totals.grossCents) * 100).toFixed(2)) : 0,
      channels: totals.channels
    }));

  return NextResponse.json({
    windowDays: days,
    data
  });
}
