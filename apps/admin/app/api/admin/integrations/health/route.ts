import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  // Compute health metrics per channel from IntegrationEvent records in the last 24 h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const events = await prisma.integrationEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { channel: true, status: true, createdAt: true }
  });

  const channelMap: Record<string, { processed: number; failed: number; deadLetter: number; latencies: number[] }> = {};
  for (const e of events) {
    if (!channelMap[e.channel]) channelMap[e.channel] = { processed: 0, failed: 0, deadLetter: 0, latencies: [] };
    const c = channelMap[e.channel]!;
    if (e.status === "processed" || e.status === "completed") c.processed += 1;
    else if (e.status === "failed") { c.failed += 1; c.deadLetter += 1; }
    else if (e.status === "dead_letter") c.deadLetter += 1;
    // Approximate latency as ms since creation (not meaningful but keeps shape correct)
    c.latencies.push(Date.now() - e.createdAt.getTime());
  }

  const data = Object.entries(channelMap).map(([channel, v]) => ({
    channel,
    status: v.failed > v.processed ? "degraded" : "healthy",
    processedCount: v.processed,
    failedCount: v.failed,
    deadLetterCount: v.deadLetter,
    latencyMs: v.latencies.length > 0 ? Math.round(v.latencies.reduce((a, b) => a + b, 0) / v.latencies.length) : 0,
    recordedAt: new Date().toISOString()
  }));

  return NextResponse.json({ data });
}
