"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader, DashboardSidebar } from "../components/DashboardLayout";import { AnalyticsChartsSkeleton, SkeletonLoader } from "../components/SkeletonLoader";
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
                  <div className="stat-card">
                    <span className="stat-label">YTD Spending</span>
                    <span className="stat-value">${spending.stats.ytdTotal.toFixed(0)}</span>
                    <span className="stat-subtext">{new Date().getFullYear()}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Avg Order Value</span>
                    <span className="stat-value">${spending.stats.averageOrderValue.toFixed(0)}</span>
                    <span className="stat-subtext">Per order</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Total Orders</span>
                    <span className="stat-value">{spending.stats.totalOrders}</span>
                    <span className="stat-subtext">All time</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Top Month</span>
                    <span className="stat-value" style={{ fontSize: "1.3rem" }}>
                      {spending.stats.topMonth.split(" ")[0]}
                    </span>
                    <span className="stat-subtext">${spending.stats.topMonthSpending.toFixed(0)}</span>
                  </div>
                </div>
              </section>

              {/* Monthly Spending Trend */}
              <section className="dashboard-section">
                <div>
                  <h2>Spending Trend</h2>
                  <p style={{ color: "var(--warm-gray)", marginTop: "0.25rem", fontSize: "0.95rem" }}>
                    Last 12 months
                  </p>
                </div>

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
              </section>

              {/* Category Breakdown and Order Frequency */}
              <div className="dashboard-grid" style={{ marginTop: "2rem" }}>
                {/* Category Breakdown */}
                <article className="panel" style={{ padding: "1.5rem" }}>
                  <h3>Spending by Category</h3>
                  <p style={{ color: "var(--warm-gray)", marginTop: "0.25rem", fontSize: "0.9rem" }}>
                    Where your BBQ budget goes
                  </p>

                  {categories && categories.categoryData.length > 0 ? (
                    <>
                      <div style={{ marginTop: "1.5rem", height: "240px" }}>
                        <DonutChart
                          data={categories.categoryData}
                          category="spending"
                          index="category"
                          valueFormatter={formatCurrency}
                          colors={["amber", "orange", "red", "rose", "pink", "purple"]}
                          showAnimation={true}
                        />
                      </div>

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
                </article>

                {/* Order Frequency */}
                <article className="panel" style={{ padding: "1.5rem" }}>
                  <h3>Order Frequency</h3>
                  <p style={{ color: "var(--warm-gray)", marginTop: "0.25rem", fontSize: "0.9rem" }}>
                    When you crave BBQ most
                  </p>

                  {frequency && frequency.frequencyData.length > 0 ? (
                    <>
                      <div style={{ marginTop: "1.5rem", height: "240px" }}>
                        <BarChart
                          data={frequency.frequencyData}
                          index="day"
                          categories={["orders"]}
                          colors={["amber"]}
                          valueFormatter={(value) => `${value} orders`}
                          yAxisWidth={40}
                          showAnimation={true}
                        />
                      </div>

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
                </article>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
