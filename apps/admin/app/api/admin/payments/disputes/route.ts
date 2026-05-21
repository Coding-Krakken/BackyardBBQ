import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

function parseEposTransactionId(reference: unknown): string | null {
  if (typeof reference !== "string") {
    return null;
  }

  const trimmed = reference.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("epos_txn_")) {
    return null;
  }

  const transactionId = trimmed.slice("epos_txn_".length).trim();
  return transactionId || null;
}

function resolveEposTransactionId(payload: Record<string, unknown>): string | null {
  if (typeof payload.eposTransactionId === "string" && payload.eposTransactionId.trim()) {
    return payload.eposTransactionId.trim();
  }

  return (
    parseEposTransactionId(payload.paymentIntentId) ??
    parseEposTransactionId(payload.stripePaymentIntentId)
  );
}

function inferDisputeProvider(payload: Record<string, unknown>, eventType: string): "stripe" | "epos" {
  const rawProvider = payload.provider;
  if (typeof rawProvider === "string") {
    const normalized = rawProvider.trim().toLowerCase();
    if (normalized === "epos") {
      return "epos";
    }
    if (normalized === "stripe") {
      return "stripe";
    }
  }

  if (eventType.startsWith("epos.") || resolveEposTransactionId(payload)) {
    return "epos";
  }

  return "epos";
}

function normalizeEpochOrIso(value: unknown): string | null {
  if (typeof value === "number") {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
      return new Date(ms).toISOString();
    }

    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return null;
}

function parseAmountCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return Math.floor(numeric);
    }
  }

  return 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin', 'accounting']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  // Disputes are stored as IntegrationEvents where eventType contains "dispute"
  const events = await prisma.integrationEvent.findMany({
    where: { eventType: { contains: "dispute" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  const data = events.map((e: typeof events[number]) => {
    const p = e.payload as Record<string, unknown>;
    const eposTransactionId = resolveEposTransactionId(p);

    return {
      id: e.id,
      disputeId: (p.disputeId as string | undefined) ?? e.id,
      paymentIntentId: (p.paymentIntentId as string | undefined) ?? "",
      amountCents: parseAmountCents(p.amountCents),
      reason: (p.reason as string | undefined) ?? "unknown",
      disputeStatus: (p.disputeStatus as string | undefined) ?? e.status,
      provider: inferDisputeProvider(p, e.eventType),
      eposTransactionId,
      dueBy: normalizeEpochOrIso(p.evidenceDueBy),
      status: e.status,
      createdAt: e.createdAt.toISOString()
    };
  });

  return NextResponse.json({ data });
}
