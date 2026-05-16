import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { getPaymentAnalytics } from "@/lib/payment-analytics";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const startDateRaw = searchParams.get("startDate");
  const endDateRaw = searchParams.get("endDate");

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const startDate = startDateRaw ? new Date(startDateRaw) : defaultStart;
  const endDate = endDateRaw ? new Date(endDateRaw) : now;

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ message: "Invalid date range" }, { status: 400 });
  }

  if (startDate > endDate) {
    return NextResponse.json({ message: "startDate must be before endDate" }, { status: 400 });
  }

  const data = await getPaymentAnalytics(startDate, endDate);
  return NextResponse.json(data);
}
