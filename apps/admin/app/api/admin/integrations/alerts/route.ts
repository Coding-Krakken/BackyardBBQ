import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failedEvents, settlementBacklog] = await Promise.all([
    prisma.integrationEvent.findMany({
      where: { createdAt: { gte: since }, status: { in: ["failed", "dead_letter"] } },
      select: { channel: true, status: true, eventType: true, payload: true }
    }),
    prisma.integrationEvent.groupBy({
      by: ["channel"],
      where: {
        createdAt: { gte: since },
        eventType: { contains: "settlement" },
        status: { in: ["queued", "pending"] }
      },
      _count: { _all: true }
    })
  ]);

  const alerts: Array<{ severity: "critical" | "warning" | "info"; channel: string; message: string }> = [];
  const channelFailures: Record<string, number> = {};
  const actionDeadLettersByChannel: Record<string, number> = {};
  const settlementDeadLettersByChannel: Record<string, number> = {};

  for (const e of failedEvents) {
    channelFailures[e.channel] = (channelFailures[e.channel] ?? 0) + 1;
    if (e.eventType === "delivery.order.action.requested" && (e.status === "dead_letter" || e.status === "failed")) {
      actionDeadLettersByChannel[e.channel] = (actionDeadLettersByChannel[e.channel] ?? 0) + 1;
    }

    if (e.eventType.includes("settlement") && (e.status === "dead_letter" || e.status === "failed")) {
      settlementDeadLettersByChannel[e.channel] = (settlementDeadLettersByChannel[e.channel] ?? 0) + 1;
    }
  }

  for (const [channel, count] of Object.entries(channelFailures)) {
    const severity: "critical" | "warning" | "info" = count > 10 ? "critical" : count > 3 ? "warning" : "info";
    alerts.push({ severity, channel, message: `${count} failed event(s) in the last 24 h` });
  }

  for (const [channel, count] of Object.entries(actionDeadLettersByChannel)) {
    const severity: "critical" | "warning" | "info" = count > 5 ? "critical" : count > 1 ? "warning" : "info";
    alerts.push({
      severity,
      channel,
      message: `${count} delivery action event(s) reached dead-letter in the last 24 h`
    });
  }

  for (const [channel, count] of Object.entries(settlementDeadLettersByChannel)) {
    const severity: "critical" | "warning" | "info" = count > 3 ? "critical" : count > 0 ? "warning" : "info";
    alerts.push({
      severity,
      channel,
      message: `${count} delivery settlement event(s) failed or reached dead-letter in the last 24 h`
    });
  }

  for (const row of settlementBacklog) {
    const count = row._count._all;
    const severity: "critical" | "warning" | "info" = count > 15 ? "critical" : count > 5 ? "warning" : "info";
    alerts.push({
      severity,
      channel: row.channel,
      message: `${count} delivery settlement event(s) are still queued/pending`
    });
  }

  const summary = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length
  };

  return NextResponse.json({ summary, alerts });
}
