"use client";

import { memo } from "react";

import { useMemo } from "react";

interface OrderStatusTimelineProps {
  status: string;
  createdAt: string;
  updatedAt: string;
}

const statusSteps = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" }
] as const;

const cancelledStatus = { key: "cancelled", label: "Cancelled" };

export function OrderStatusTimeline({ status, createdAt, updatedAt }: OrderStatusTimelineProps) {
  const currentStatusIndex = useMemo(() => {
    if (status === "cancelled") return -1;
    return statusSteps.findIndex((step) => step.key === status);
  }, [status]);

  if (status === "cancelled") {
    return (
      <div className="order-timeline">
        <div className="timeline-step active">
          <div className="timeline-dot">✕</div>
          <span className="timeline-label">Cancelled</span>
        </div>
      </div>
    );
  }

  return (
    <div className="order-timeline">
      {statusSteps.map((step, index) => {
        const isActive = index === currentStatusIndex;
        const isCompleted = index < currentStatusIndex;
        const className = `timeline-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`;

        return (
          <div key={step.key} className={className}>
            <div className="timeline-dot">
              {isCompleted ? "✓" : isActive ? "●" : "○"}
            </div>
            <span className="timeline-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface BookingStatusTimelineProps {
  status: string;
}

const bookingStatusSteps = [
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending" },
  { key: "approved", label: "Approved" }
] as const;

export function BookingStatusTimeline({ status }: BookingStatusTimelineProps) {
  const currentStatusIndex = useMemo(() => {
    if (status === "cancelled" || status === "declined") return -1;
    return bookingStatusSteps.findIndex((step) => step.key === status);
  }, [status]);

  if (status === "cancelled" || status === "declined") {
    return (
      <div className="order-timeline">
        <div className="timeline-step active">
          <div className="timeline-dot">✕</div>
          <span className="timeline-label">
            {status === "cancelled" ? "Cancelled" : "Declined"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="order-timeline">
      {bookingStatusSteps.map((step, index) => {
        const isActive = index === currentStatusIndex;
        const isCompleted = index < currentStatusIndex;
        const className = `timeline-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`;

        return (
          <div key={step.key} className={className}>
            <div className="timeline-dot">
              {isCompleted ? "✓" : isActive ? "●" : "○"}
            </div>
            <span className="timeline-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
