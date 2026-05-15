"use client";

import { memo, useMemo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { staggerContainer, staggerItem, springs } from "../../lib/animations";

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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  const currentStatusIndex = useMemo(() => {
    if (status === "cancelled") return -1;
    return statusSteps.findIndex((step) => step.key === status);
  }, [status]);

  if (status === "cancelled") {
    return (
      <motion.div 
        className="order-timeline"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div 
          className="timeline-step active"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springs.bounce}
        >
          <div className="timeline-dot">✕</div>
          <span className="timeline-label">Cancelled</span>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="order-timeline"
      ref={ref}
      variants={staggerContainer}
      initial="initial"
      animate={isInView ? "animate" : "initial"}
    >
      {statusSteps.map((step, index) => {
        const isActive = index === currentStatusIndex;
        const isCompleted = index < currentStatusIndex;
        const className = `timeline-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`;

        return (
          <motion.div 
            key={step.key} 
            className={className}
            variants={staggerItem}
          >
            <motion.div 
              className="timeline-dot"
              animate={isActive ? { scale: [1, 1.2, 1] } : {}}
              transition={isActive ? { 
                duration: 2, 
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              } : {}}
            >
              {isCompleted ? "✓" : isActive ? "●" : "○"}
            </motion.div>
            <span className="timeline-label">{step.label}</span>
          </motion.div>
        );
      })}
    </motion.div>
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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  const currentStatusIndex = useMemo(() => {
    if (status === "cancelled" || status === "declined") return -1;
    return bookingStatusSteps.findIndex((step) => step.key === status);
  }, [status]);

  if (status === "cancelled" || status === "declined") {
    return (
      <motion.div 
        className="order-timeline"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div 
          className="timeline-step active"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springs.bounce}
        >
          <div className="timeline-dot">✕</div>
          <span className="timeline-label">
            {status === "cancelled" ? "Cancelled" : "Declined"}
          </span>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="order-timeline"
      ref={ref}
      variants={staggerContainer}
      initial="initial"
      animate={isInView ? "animate" : "initial"}
    >
      {bookingStatusSteps.map((step, index) => {
        const isActive = index === currentStatusIndex;
        const isCompleted = index < currentStatusIndex;
        const className = `timeline-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`;

        return (
          <motion.div 
            key={step.key} 
            className={className}
            variants={staggerItem}
          >
            <motion.div 
              className="timeline-dot"
              animate={isActive ? { scale: [1, 1.2, 1] } : {}}
              transition={isActive ? { 
                duration: 2, 
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              } : {}}
            >
              {isCompleted ? "✓" : isActive ? "●" : "○"}
            </motion.div>
            <span className="timeline-label">{step.label}</span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
