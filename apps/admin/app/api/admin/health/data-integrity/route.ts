import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/requireAdmin";
import { checkDataIntegrity } from "../../../../../../lib/financialMetrics";

let lastAlertAt = 0;

async function maybeSendIntegrityAlert(payload: {
  details: string;
  ordersWithoutPayments: number;
  paymentsWithoutOrders: number;
  sumDifferenceCents: number;
}) {
  const webhookUrl = process.env.DATA_INTEGRITY_ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const now = Date.now();
  const cooldownMs = 30 * 60 * 1000;
  if (now - lastAlertAt < cooldownMs) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "admin-data-integrity",
        severity: "critical",
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });
    lastAlertAt = now;
  } catch (error) {
    console.error("Failed to send data integrity alert:", error);
  }
}

export async function GET() {
  const auth = await requireAdmin(["owner", "admin", "manager", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const integrity = await checkDataIntegrity();

    if (!integrity.healthy) {
      await maybeSendIntegrityAlert({
        details: integrity.details ?? "Integrity mismatch detected",
        ordersWithoutPayments: integrity.ordersWithoutPayments,
        paymentsWithoutOrders: integrity.paymentsWithoutOrders,
        sumDifferenceCents: integrity.sumDifferenceCents,
      });
    }

    // Return with appropriate status code for monitoring
    return NextResponse.json(integrity, {
      status: integrity.healthy ? 200 : 503,
    });
  } catch (error) {
    console.error("Data integrity check failed:", error);
    return NextResponse.json(
      {
        healthy: false,
        error: "Failed to run integrity check",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
