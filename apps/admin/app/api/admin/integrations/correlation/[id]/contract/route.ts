import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

type ContractCheck = {
  key: string;
  label: string;
  passed: boolean;
  details: string;
  evidenceEventIds: string[];
};

function readPayloadCorrelationId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  return typeof record.correlationId === "string" ? record.correlationId : null;
}

function buildCheck(input: {
  key: string;
  label: string;
  passed: boolean;
  details: string;
  evidenceEventIds?: string[];
}): ContractCheck {
  return {
    key: input.key,
    label: input.label,
    passed: input.passed,
    details: input.details,
    evidenceEventIds: input.evidenceEventIds ?? []
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const correlationId = params.id?.trim();
  if (!correlationId) {
    return NextResponse.json({ message: "Missing correlation ID" }, { status: 400 });
  }

  const where: Prisma.IntegrationEventWhereInput = {
    payload: {
      path: ["correlationId"],
      equals: correlationId
    }
  };

  const events = await prisma.integrationEvent.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 2000,
    select: {
      id: true,
      channel: true,
      eventType: true,
      status: true,
      createdAt: true,
      payload: true
    }
  });

  const statusCounts: Record<string, number> = {};
  const eventTypeCounts: Record<string, number> = {};
  const channels = new Set<string>();

  for (const event of events) {
    statusCounts[event.status] = (statusCounts[event.status] ?? 0) + 1;
    eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] ?? 0) + 1;
    channels.add(event.channel);
  }

  const webhookOrderEvents = events.filter((event) => event.eventType === "delivery.webhook.order.received");
  const webhookStatusEvents = events.filter((event) => event.eventType === "delivery.webhook.status.received");
  const dispatchEvents = events.filter((event) => event.eventType === "delivery.dispatch.requested");
  const actionEvents = events.filter((event) => event.eventType === "delivery.order.action.requested");
  const settlementEvents = events.filter((event) => event.eventType.includes("settlement"));
  const deadLetterOrFailedEvents = events.filter(
    (event) => event.status === "dead_letter" || event.status === "failed"
  );

  const nonUniformCorrelationEvents = events.filter((event) => {
    const payloadCorrelationId = readPayloadCorrelationId(event.payload);
    return payloadCorrelationId !== correlationId;
  });

  const checks: ContractCheck[] = [
    buildCheck({
      key: "has_events",
      label: "Correlation has events",
      passed: events.length > 0,
      details: events.length > 0 ? `${events.length} event(s) found` : "No events found for correlation"
    }),
    buildCheck({
      key: "webhook_order_present",
      label: "Inbound order webhook observed",
      passed: webhookOrderEvents.length > 0,
      details:
        webhookOrderEvents.length > 0
          ? `${webhookOrderEvents.length} order webhook event(s)`
          : "Missing delivery.webhook.order.received",
      evidenceEventIds: webhookOrderEvents.slice(0, 5).map((event) => event.id)
    }),
    buildCheck({
      key: "webhook_status_present",
      label: "Inbound status webhook observed",
      passed: webhookStatusEvents.length > 0,
      details:
        webhookStatusEvents.length > 0
          ? `${webhookStatusEvents.length} status webhook event(s)`
          : "Missing delivery.webhook.status.received",
      evidenceEventIds: webhookStatusEvents.slice(0, 5).map((event) => event.id)
    }),
    buildCheck({
      key: "dispatch_present",
      label: "Dispatch request observed",
      passed: dispatchEvents.length > 0,
      details:
        dispatchEvents.length > 0
          ? `${dispatchEvents.length} dispatch event(s)`
          : "Missing delivery.dispatch.requested",
      evidenceEventIds: dispatchEvents.slice(0, 5).map((event) => event.id)
    }),
    buildCheck({
      key: "action_present",
      label: "Order action observed",
      passed: actionEvents.length > 0,
      details:
        actionEvents.length > 0
          ? `${actionEvents.length} action event(s)`
          : "Missing delivery.order.action.requested",
      evidenceEventIds: actionEvents.slice(0, 5).map((event) => event.id)
    }),
    buildCheck({
      key: "settlement_present",
      label: "Settlement processing observed",
      passed: settlementEvents.length > 0,
      details:
        settlementEvents.length > 0
          ? `${settlementEvents.length} settlement-related event(s)`
          : "Missing settlement events",
      evidenceEventIds: settlementEvents.slice(0, 5).map((event) => event.id)
    }),
    buildCheck({
      key: "no_failed_or_dead_letter",
      label: "No failed/dead-letter events",
      passed: deadLetterOrFailedEvents.length === 0,
      details:
        deadLetterOrFailedEvents.length === 0
          ? "No failed or dead-letter events"
          : `${deadLetterOrFailedEvents.length} failed/dead-letter event(s) found`,
      evidenceEventIds: deadLetterOrFailedEvents.slice(0, 5).map((event) => event.id)
    }),
    buildCheck({
      key: "uniform_correlation",
      label: "Uniform correlation ID in payloads",
      passed: nonUniformCorrelationEvents.length === 0,
      details:
        nonUniformCorrelationEvents.length === 0
          ? "All payload correlation IDs match"
          : `${nonUniformCorrelationEvents.length} event(s) have mismatched or missing correlation IDs`,
      evidenceEventIds: nonUniformCorrelationEvents.slice(0, 5).map((event) => event.id)
    })
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  const failedCount = checks.length - passedCount;

  return NextResponse.json({
    correlationId,
    summary: {
      totalEvents: events.length,
      firstSeenAt: events[0]?.createdAt.toISOString() ?? null,
      lastSeenAt: events[events.length - 1]?.createdAt.toISOString() ?? null,
      channels: Array.from(channels).sort(),
      statuses: statusCounts,
      eventTypes: eventTypeCounts
    },
    checks,
    result: {
      passed: failedCount === 0,
      passedCount,
      failedCount,
      scorePercent: checks.length > 0 ? Math.round((passedCount / checks.length) * 100) : 0
    }
  });
}
