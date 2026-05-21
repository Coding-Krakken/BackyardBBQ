import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

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

  if (eventType.startsWith("epos.") || (typeof payload.eposTransactionId === "string" && payload.eposTransactionId.length > 0)) {
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

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const event = await prisma.integrationEvent.findUnique({
    where: { id: params.id },
  });

  if (!event || !event.eventType.includes("dispute")) {
    return NextResponse.json({ message: "Dispute event not found" }, { status: 404 });
  }

  const payload = (event.payload ?? {}) as Record<string, unknown>;

  const data = {
    id: event.id,
    eventType: event.eventType,
    status: event.status,
    createdAt: event.createdAt,
    disputeId: typeof payload.disputeId === "string" ? payload.disputeId : null,
    paymentIntentId:
      typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null,
    amountCents: parseAmountCents(payload.amountCents),
    currency: typeof payload.currency === "string" ? payload.currency : "usd",
    reason: typeof payload.reason === "string" ? payload.reason : "unknown",
    provider: inferDisputeProvider(payload, event.eventType),
    eposTransactionId:
      typeof payload.eposTransactionId === "string" ? payload.eposTransactionId : null,
    disputeStatus:
      typeof payload.disputeStatus === "string" ? payload.disputeStatus : event.status,
    evidence:
      payload.evidence && typeof payload.evidence === "object"
        ? payload.evidence
        : null,
    dueBy: normalizeEpochOrIso(payload.evidenceDueBy),
    updatedAt: normalizeEpochOrIso(payload.updatedAt),
  };

  return NextResponse.json({ data });
}
