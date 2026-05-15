"use client";

import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeInUp, staggerContainer, staggerItem, easings } from "../../lib/animations";

interface SkeletonLoaderProps {
  variant?: "text" | "card" | "stat" | "chart" | "table";
  count?: number;
  height?: string;
  width?: string;
  className?: string;
}

export const SkeletonLoader = memo(function SkeletonLoader({
  variant = "card",
  count = 1,
  height,
  width,
  className = ""
}: SkeletonLoaderProps) {
  const renderSkeleton = () => {
    const pulseAnimation = {
      opacity: [0.5, 0.8, 0.5],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: easings.smooth
      }
    };

    switch (variant) {
      case "text":
        return (
          <motion.div
            className={`skeleton-shimmer ${className}`}
            style={{
              height: height || "1rem",
              width: width || "100%",
              borderRadius: "4px"
            }}
            animate={pulseAnimation}
          />
        );

      case "stat":
        return (
          <motion.div 
            className={`panel ${className}`}
            variants={fadeInUp}
            initial="initial"
            animate="animate"
          >
            <motion.div 
              className="skeleton-shimmer" 
              style={{ height: "1rem", width: "60%", borderRadius: "4px", marginBottom: "0.75rem" }}
              animate={pulseAnimation}
            />
            <motion.div 
              className="skeleton-shimmer" 
              style={{ height: "2rem", width: "40%", borderRadius: "4px" }}
              animate={pulseAnimation}
            />
          </motion.div>
        );

      case "card":
        return (
          <motion.div 
            className={`panel ${className}`}
            variants={fadeInUp}
            initial="initial"
            animate="animate"
          >
            <motion.div 
              className="skeleton-shimmer" 
              style={{ height: "1.5rem", width: "70%", borderRadius: "4px", marginBottom: "1rem" }}
              animate={pulseAnimation}
            />
            <motion.div 
              className="skeleton-shimmer" 
              style={{ height: "1rem", width: "100%", borderRadius: "4px", marginBottom: "0.5rem" }}
              animate={pulseAnimation}
            />
            <motion.div 
              className="skeleton-shimmer" 
              style={{ height: "1rem", width: "90%", borderRadius: "4px", marginBottom: "0.5rem" }}
              animate={pulseAnimation}
            />
            <motion.div 
              className="skeleton-shimmer" 
              style={{ height: "1rem", width: "80%", borderRadius: "4px" }}
              animate={pulseAnimation}
            />
          </motion.div>
        );

      case "chart":
        return (
          <motion.div 
            className={`panel ${className}`}
            variants={fadeInUp}
            initial="initial"
            animate="animate"
          >
            <motion.div 
              className="skeleton-shimmer" 
              style={{ height: "1.5rem", width: "50%", borderRadius: "4px", marginBottom: "1.5rem" }}
              animate={pulseAnimation}
            />
            <motion.div 
              className="skeleton-shimmer" 
              style={{ height: height || "300px", width: "100%", borderRadius: "8px" }}
              animate={pulseAnimation}
            />
          </motion.div>
        );

      case "table":
        return (
          <motion.div 
            className={`panel ${className}`}
            variants={fadeInUp}
            initial="initial"
            animate="animate"
          >
            {/* Header row */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--line-soft)" }}>
              <motion.div className="skeleton-shimmer" style={{ height: "1rem", width: "25%", borderRadius: "4px" }} animate={pulseAnimation} />
              <motion.div className="skeleton-shimmer" style={{ height: "1rem", width: "20%", borderRadius: "4px" }} animate={pulseAnimation} />
              <motion.div className="skeleton-shimmer" style={{ height: "1rem", width: "30%", borderRadius: "4px" }} animate={pulseAnimation} />
              <motion.div className="skeleton-shimmer" style={{ height: "1rem", width: "25%", borderRadius: "4px" }} animate={pulseAnimation} />
            </div>
            {/* Data rows */}
            {[...Array(5)].map((_, i) => (
              <motion.div 
                key={i} 
                style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <motion.div className="skeleton-shimmer" style={{ height: "1rem", width: "25%", borderRadius: "4px" }} animate={pulseAnimation} />
                <motion.div className="skeleton-shimmer" style={{ height: "1rem", width: "20%", borderRadius: "4px" }} animate={pulseAnimation} />
                <motion.div className="skeleton-shimmer" style={{ height: "1rem", width: "30%", borderRadius: "4px" }} animate={pulseAnimation} />
                <motion.div className="skeleton-shimmer" style={{ height: "1rem", width: "25%", borderRadius: "4px" }} animate={pulseAnimation} />
              </motion.div>
            ))}
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {[...Array(count)].map((_, index) => (
        <React.Fragment key={index}>
          {renderSkeleton()}
        </React.Fragment>
      ))}
    </>
  );
});

export function DashboardStatsSkeleton() {
  return (
    <motion.div 
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <SkeletonLoader variant="stat" count={4} />
    </motion.div>
  );
}

export function OrderListSkeleton() {
  return (
    <motion.div 
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <SkeletonLoader variant="card" count={3} />
    </motion.div>
  );
}

export function AnalyticsChartsSkeleton() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <DashboardStatsSkeleton />
      <div style={{ display: "grid", gap: "2rem" }}>
        <SkeletonLoader variant="chart" height="300px" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
          <SkeletonLoader variant="chart" height="250px" />
          <SkeletonLoader variant="chart" height="250px" />
        </div>
      </div>
    </motion.div>
  );
}
