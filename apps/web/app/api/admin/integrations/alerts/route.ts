import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events = await prisma.integrationEvent.findMany({
    where: { createdAt: { gte: since }, status: { in: ["failed", "dead_letter"] } },
    select: { channel: true, status: true, eventType: true, payload: true }
  });

  const alerts: Array<{ severity: "critical" | "warning" | "info"; channel: string; message: string }> = [];
  const channelFailures: Record<string, number> = {};

  for (const e of events) {
    channelFailures[e.channel] = (channelFailures[e.channel] ?? 0) + 1;
  }

  for (const [channel, count] of Object.entries(channelFailures)) {
    const severity: "critical" | "warning" | "info" = count > 10 ? "critical" : count > 3 ? "warning" : "info";
    alerts.push({ severity, channel, message: `${count} failed event(s) in the last 24 h` });
  }

  const summary = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length
  };

  return NextResponse.json({ summary, alerts });
}
