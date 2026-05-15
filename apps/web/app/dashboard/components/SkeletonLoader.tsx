"use client";

import React, { memo } from "react";

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
    switch (variant) {
      case "text":
        return (
          <div
            className={`skeleton-shimmer ${className}`}
            style={{
              height: height || "1rem",
              width: width || "100%",
              borderRadius: "4px"
            }}
          />
        );

      case "stat":
        return (
          <div className={`panel ${className}`}>
            <div className="skeleton-shimmer" style={{ height: "1rem", width: "60%", borderRadius: "4px", marginBottom: "0.75rem" }} />
            <div className="skeleton-shimmer" style={{ height: "2rem", width: "40%", borderRadius: "4px" }} />
          </div>
        );

      case "card":
        return (
          <div className={`panel ${className}`}>
            <div className="skeleton-shimmer" style={{ height: "1.5rem", width: "70%", borderRadius: "4px", marginBottom: "1rem" }} />
            <div className="skeleton-shimmer" style={{ height: "1rem", width: "100%", borderRadius: "4px", marginBottom: "0.5rem" }} />
            <div className="skeleton-shimmer" style={{ height: "1rem", width: "90%", borderRadius: "4px", marginBottom: "0.5rem" }} />
            <div className="skeleton-shimmer" style={{ height: "1rem", width: "80%", borderRadius: "4px" }} />
          </div>
        );

      case "chart":
        return (
          <div className={`panel ${className}`}>
            <div className="skeleton-shimmer" style={{ height: "1.5rem", width: "50%", borderRadius: "4px", marginBottom: "1.5rem" }} />
            <div className="skeleton-shimmer" style={{ height: height || "300px", width: "100%", borderRadius: "8px" }} />
          </div>
        );

      case "table":
        return (
          <div className={`panel ${className}`}>
            {/* Header row */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--line-soft)" }}>
              <div className="skeleton-shimmer" style={{ height: "1rem", width: "25%", borderRadius: "4px" }} />
              <div className="skeleton-shimmer" style={{ height: "1rem", width: "20%", borderRadius: "4px" }} />
              <div className="skeleton-shimmer" style={{ height: "1rem", width: "30%", borderRadius: "4px" }} />
              <div className="skeleton-shimmer" style={{ height: "1rem", width: "25%", borderRadius: "4px" }} />
            </div>
            {/* Data rows */}
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
                <div className="skeleton-shimmer" style={{ height: "1rem", width: "25%", borderRadius: "4px" }} />
                <div className="skeleton-shimmer" style={{ height: "1rem", width: "20%", borderRadius: "4px" }} />
                <div className="skeleton-shimmer" style={{ height: "1rem", width: "30%", borderRadius: "4px" }} />
                <div className="skeleton-shimmer" style={{ height: "1rem", width: "25%", borderRadius: "4px" }} />
              </div>
            ))}
          </div>
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
      <SkeletonLoader variant="stat" count={3} />
    </div>
  );
}

export function OrderListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <SkeletonLoader variant="card" count={3} />
    </div>
  );
}

export function AnalyticsChartsSkeleton() {
  return (
    <>
      <DashboardStatsSkeleton />
      <div style={{ display: "grid", gap: "2rem" }}>
        <SkeletonLoader variant="chart" height="300px" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
          <SkeletonLoader variant="chart" height="250px" />
          <SkeletonLoader variant="chart" height="250px" />
        </div>
      </div>
    </>
  );
}
