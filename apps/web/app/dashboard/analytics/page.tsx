"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, lazy, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import { DashboardHeader, DashboardSidebar } from "../components/DashboardLayout";
import { AnalyticsChartsSkeleton } from "../components/SkeletonLoader";
import { CountUpStat } from "../components/CountUpStat";
import { durations, easings } from "../../lib/animations";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { ANIMATION_CONSTANTS, ERROR_MESSAGES } from "../../lib/constants";

// Lazy load Tremor charts for better performance
const AreaChart = lazy(() => import("@tremor/react").then(m => ({ default: m.AreaChart })));
const DonutChart = lazy(() => import("@tremor/react").then(m => ({ default: m.DonutChart })));
const BarChart = lazy(() => import("@tremor/react").then(m => ({ default: m.BarChart })));
const Card = lazy(() => import("@tremor/react").then(m => ({ default: m.Card })));

interface SpendingData {
  monthlyData: Array<{ month: string; spending: number }>;
  stats: {
    ytdTotal: number;
    averageOrderValue: number;
    totalOrders: number;
    topMonth: string;
    topMonthSpending: number;
  };
}

interface CategoryData {
  categoryData: Array<{ category: string; spending: number; percentage: number }>;
  totalSpent: number;
}

interface FrequencyData {
  frequencyData: Array<{ day: string; orders: number }>;
  insights: {
    totalOrders: number;
    averagePerMonth: number;
    mostActiveDay: string;
    orderingStreak: number;
  };
}

export default function AnalyticsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [spending, setSpending] = useState<SpendingData | null>(null);
  const [categories, setCategories] = useState<CategoryData | null>(null);
  const [frequency, setFrequency] = useState<FrequencyData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Refs for scroll-triggered chart animations
  const trendChartRef = useRef(null);
  const categoryChartRef = useRef(null);
  const frequencyChartRef = useRef(null);
  
  const isTrendInView = useInView(trendChartRef, { once: true, margin: ANIMATION_CONSTANTS.SCROLL_TRIGGER_MARGIN });
  const isCategoryInView = useInView(categoryChartRef, { once: true, margin: ANIMATION_CONSTANTS.SCROLL_TRIGGER_MARGIN });
  const isFrequencyInView = useInView(frequencyChartRef, { once: true, margin: ANIMATION_CONSTANTS.SCROLL_TRIGGER_MARGIN });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchAnalytics();
    }
  }, [status]);

  const fetchAnalytics = async () => {
    try {
      const [spendingRes, categoriesRes, frequencyRes] = await Promise.all([
        fetch("/api/customer/analytics/spending"),
        fetch("/api/customer/analytics/categories"),
        fetch("/api/customer/analytics/frequency")
      ]);

      if (spendingRes.ok) {
        const data = await spendingRes.json();
        setSpending(data);
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data);
      }

      if (frequencyRes.ok) {
        const data = await frequencyRes.json();
        setFrequency(data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  if (status === "loading" || loading) {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <h1 style={{ marginBottom: "2rem" }}>📈 Analytics & Insights</h1>
            <AnalyticsChartsSkeleton />
          </main>
        </div>
      </>
    );
  }

  const hasData = spending && spending.stats.totalOrders > 0;

  return (
    <>
      <DashboardHeader />
      <div className="dashboard-container">
        <DashboardSidebar />
        <main id="main-content" className="dashboard-main">
          <section className="dashboard-section">
            <h1>Spending Analytics</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              View your BBQ spending patterns, trends, and insights.
            </p>
          </section>

          {!hasData ? (
            <div className="panel" style={{ textAlign: "center", padding: "3rem 2rem" }}>
              <p style={{ color: "var(--warm-gray)", fontSize: "1.1rem" }}>
                📊 No order data yet. Place your first order to see analytics!
              </p>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <section className="dashboard-section">
                <div className="stat-cards">
                  <CountUpStat
                    label="YTD Spending"
                    value={spending.stats.ytdTotal}
                    subtext={new Date().getFullYear().toString()}
                    prefix="$"
                    decimals={0}
                    delay={0}
                  />
                  <CountUpStat
                    label="Avg Order Value"
                    value={spending.stats.averageOrderValue}
                    subtext="Per order"
                    prefix="$"
                    decimals={0}
                    delay={0.1}
                  />
                  <CountUpStat
                    label="Total Orders"
                    value={spending.stats.totalOrders}
                    subtext="All time"
                    delay={0.2}
                  />
                  <div className="stat-card">
                    <span className="stat-label">Top Month</span>
                    <span className="stat-value" style={{ fontSize: "1.3rem" }}>
                      {spending.stats.topMonth.split(" ")[0]}
                    </span>
                    <span className="stat-subtext">${spending.stats.topMonthSpending.toFixed(0)}</span>
                  </div>
                </div>
              </section>

              {/* Monthly Spending Trend - Animated */}
              <motion.section
                className="dashboard-section"
                ref={trendChartRef}
                initial={{ opacity: 0, y: 40 }}
                animate={isTrendInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ duration: durations.slow, ease: easings.easeOut }}
              >
                <div>
                  <h2>Spending Trend</h2>
                  <p style={{ color: "var(--warm-gray)", marginTop: "0.25rem", fontSize: "0.95rem" }}>
                    Last 12 months
                  </p>
                </div>

                <ErrorBoundary fallback={<div style={{ height: "300px", padding: "2rem", textAlign: "center" }}>Unable to load chart</div>}>
                  <Suspense fallback={<div style={{ height: "300px" }} />}>
                    <motion.div
                      initial={{ opacity: 0, scaleY: 0.8 }}
                      animate={isTrendInView ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0.8 }}
                      transition={{ duration: durations.normal, delay: ANIMATION_CONSTANTS.DELAY_MEDIUM, ease: easings.easeOut }}
                      style={{ transformOrigin: "bottom" }}
                    >
                      <Card
                      style={{
                        marginTop: "1.5rem",
                        background: "var(--panel)",
                        border: "1px solid var(--line-soft)",
                        padding: "1.5rem"
                      }}
                    >
                      <div style={{ height: "300px" }}>
                        <AreaChart
                          data={spending.monthlyData}
                          index="month"
                          categories={["spending"]}
                          colors={["amber"]}
                          valueFormatter={formatCurrency}
                          yAxisWidth={60}
                          showAnimation={true}
                          curveType="natural"
                        />
                      </div>
                      </Card>
                    </motion.div>
                  </Suspense>
                </ErrorBoundary>
              </motion.section>

              {/* Category Breakdown and Order Frequency */}
              <div className="dashboard-grid" style={{ marginTop: "2rem" }}>
                {/* Category Breakdown - Animated */}
                <motion.article
                  className="panel"
                  style={{ padding: "1.5rem" }}
                  ref={categoryChartRef}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isCategoryInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                  transition={{ duration: durations.slow, delay: 0.1, ease: easings.easeOut }}
                >
                  <h3>Spending by Category</h3>
                  <p style={{ color: "var(--warm-gray)", marginTop: "0.25rem", fontSize: "0.9rem" }}>
                    Where your BBQ budget goes
                  </p>

                  {categories && categories.categoryData.length > 0 ? (
                    <>
                      <ErrorBoundary fallback={<div style={{ height: "240px", padding: "2rem", textAlign: "center" }}>Unable to load chart</div>}>
                        <Suspense fallback={<div style={{ height: "240px" }} />}>
                          <motion.div
                            style={{ marginTop: "1.5rem", height: "240px" }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={isCategoryInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                            transition={{ duration: durations.normal, delay: ANIMATION_CONSTANTS.DELAY_LARGE, ease: easings.easeOut }}
                          >
                            <DonutChart
                              data={categories.categoryData}
                              category="spending"
                              index="category"
                              valueFormatter={formatCurrency}
                              colors={["amber", "orange", "red", "rose", "pink", "purple"]}
                              showAnimation={true}
                            />
                          </motion.div>
                        </Suspense>
                      </ErrorBoundary>

                      <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {categories.categoryData.slice(0, 3).map((cat) => (
                          <div
                            key={cat.category}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "0.5rem",
                              background: "rgba(3, 8, 11, 0.4)",
                              borderRadius: "6px"
                            }}
                          >
                            <span style={{ fontSize: "0.9rem" }}>{cat.category}</span>
                            <span style={{ fontSize: "0.9rem", color: "var(--ember)" }}>
                              ${cat.spending.toFixed(2)} ({cat.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p style={{ color: "var(--warm-gray)", marginTop: "1rem" }}>
                      No category data available
                    </p>
                  )}
                </motion.article>

                {/* Order Frequency - Animated */}
                <motion.article
                  className="panel"
                  style={{ padding: "1.5rem" }}
                  ref={frequencyChartRef}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isFrequencyInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                  transition={{ duration: durations.slow, delay: 0.2, ease: easings.easeOut }}
                >
                  <h3>Order Frequency</h3>
                  <p style={{ color: "var(--warm-gray)", marginTop: "0.25rem", fontSize: "0.9rem" }}>
                    When you crave BBQ most
                  </p>

                  {frequency && frequency.frequencyData.length > 0 ? (
                    <>
                      <ErrorBoundary fallback={<div style={{ height: "240px", padding: "2rem", textAlign: "center" }}>Unable to load chart</div>}>
                        <Suspense fallback={<div style={{ height: "240px" }} />}>
                          <motion.div
                            style={{ marginTop: "1.5rem", height: "240px", transformOrigin: "bottom" }}
                            initial={{ opacity: 0, scaleY: 0.8 }}
                            animate={isFrequencyInView ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0.8 }}
                            transition={{ duration: durations.normal, delay: ANIMATION_CONSTANTS.DELAY_XL, ease: easings.easeOut }}
                          >
                            <BarChart
                              data={frequency.frequencyData}
                              index="day"
                              categories={["orders"]}
                              colors={["amber"]}
                              valueFormatter={(value) => `${value} orders`}
                              yAxisWidth={40}
                              showAnimation={true}
                            />
                          </motion.div>
                        </Suspense>
                      </ErrorBoundary>

                      <div style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        <div
                          style={{
                            padding: "0.75rem",
                            background: "rgba(3, 8, 11, 0.4)",
                            borderRadius: "6px",
                            textAlign: "center"
                          }}
                        >
                          <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)" }}>Most Active</div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--ember)", marginTop: "0.25rem" }}>
                            {frequency.insights.mostActiveDay}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "0.75rem",
                            background: "rgba(3, 8, 11, 0.4)",
                            borderRadius: "6px",
                            textAlign: "center"
                          }}
                        >
                          <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)" }}>Avg/Month</div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--brass)", marginTop: "0.25rem" }}>
                            {frequency.insights.averagePerMonth}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: "var(--warm-gray)", marginTop: "1rem" }}>
                      No frequency data available
                    </p>
                  )}
                </motion.article>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
