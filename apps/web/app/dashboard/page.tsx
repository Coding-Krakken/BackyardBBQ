"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader, DashboardSidebar } from "./components/DashboardLayout";
import { DashboardStatsSkeleton, OrderListSkeleton } from "./components/SkeletonLoader";
import { QuickReorderGrid } from "./components/QuickReorderGrid";
import { FavoriteItems } from "./components/FavoriteItems";
import { CountUpStat } from "./components/CountUpStat";

interface DashboardStats {
  totalOrders: number;
  activeOrders: number;
  upcomingBookings: number;
  totalSpentCents: number;
}

interface Order {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  items: Array<{ 
    menuItemName: string; 
    quantity: number;
    unitPriceCents: number;
  }>;
  location: { name: string };
}

interface Booking {
  id: string;
  eventDate: string;
  partySize: number;
  status: string;
  packageName: string | null;
}

export default function CustomerDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchDashboardData();
    }
  }, [status]);

  const fetchDashboardData = async () => {
    try {
      const [ordersRes, bookingsRes, favoritesRes] = await Promise.all([
        fetch("/api/customer/orders?limit=10"),
        fetch("/api/customer/bookings?upcoming=true&limit=3"),
        fetch("/api/customer/favorites")
      ]);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData.orders || []);

        // Calculate stats
        const totalOrders = ordersData.pagination.total;
        const activeOrders = ordersData.orders.filter(
          (o: Order) => ["pending", "confirmed", "preparing", "ready"].includes(o.status)
        ).length;
        const totalSpentCents = ordersData.orders.reduce(
          (sum: number, o: Order) => sum + o.totalCents,
          0
        );

        setStats({
          totalOrders,
          activeOrders,
          upcomingBookings: 0,
          totalSpentCents
        });
      }

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        setUpcomingBookings(bookingsData.bookings || []);

        setStats((prev) => ({
          ...prev!,
          upcomingBookings: bookingsData.pagination.total
        }));
      }

      if (favoritesRes.ok) {
        const favoritesData = await favoritesRes.json();
        setFavorites(favoritesData.favorites || []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <div className="dashboard-hero" style={{ marginBottom: "2rem" }}>
              <div className="skeleton-shimmer" style={{ height: "2rem", width: "250px", borderRadius: "4px", marginBottom: "0.5rem" }} />
              <div className="skeleton-shimmer" style={{ height: "1rem", width: "180px", borderRadius: "4px" }} />
            </div>
            <DashboardStatsSkeleton />
            <div style={{ marginBottom: "2rem" }}>
              <div className="skeleton-shimmer" style={{ height: "1.5rem", width: "150px", borderRadius: "4px", marginBottom: "1rem" }} />
              <OrderListSkeleton />
            </div>
          </main>
        </div>
      </>
    );
  }

  if (!session) {
    return null;
  }

  const displayName = session.user.name || "Customer";

  return (
    <>
      <DashboardHeader />
      <div className="dashboard-container">
        <DashboardSidebar />
        <main id="main-content" className="dashboard-main">
          <section className="dashboard-section">
            <h1>Welcome back, {displayName}! 👋</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              Track your orders, manage bookings, and view your BBQ journey all in one place.
            </p>
          </section>

          <section className="dashboard-section">
            <div className="stat-cards">
              <CountUpStat
                label="Total Orders"
                value={stats?.totalOrders || 0}
                subtext="All time"
                delay={0}
              />
              <CountUpStat
                label="Active Orders"
                value={stats?.activeOrders || 0}
                subtext="In progress"
                delay={0.1}
              />
              <CountUpStat
                label="Upcoming Events"
                value={stats?.upcomingBookings || 0}
                subtext="Catering bookings"
                delay={0.2}
              />
              <CountUpStat
                label="Total Spent"
                value={(stats?.totalSpentCents || 0) / 100}
                subtext="Lifetime value"
                prefix="$"
                decimals={0}
                delay={0.3}
              />
            </div>
          </section>

          <QuickReorderGrid 
            recentOrders={recentOrders} 
            onReorderSuccess={fetchDashboardData}
          />

          <FavoriteItems favorites={favorites} />

          <div className="dashboard-grid">
            <article className="panel dashboard-card">
              <h3>Recent Orders</h3>
              {recentOrders.length > 0 ? (
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  {recentOrders.slice(0, 3).map((order) => (
                    <div
                      key={order.id}
                      style={{
                        padding: "0.8rem",
                        background: "rgba(3, 8, 11, 0.4)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line-soft)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                        <strong style={{ color: "var(--cream)" }}>
                          {order.items[0]?.menuItemName || "Order"}
                          {order.items.length > 1 && ` +${order.items.length - 1} more`}
                        </strong>
                        <span
                          style={{
                            color: "var(--ember-soft)",
                            fontWeight: 600
                          }}
                        >
                          ${(order.totalCents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)" }}>
                        {order.location.name} • {order.status}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--warm-gray)", marginTop: "1rem" }}>
                  No orders yet. Ready to order some delicious BBQ?
                </p>
              )}
              <Link className="btn btn-secondary" href="/dashboard/orders" style={{ marginTop: "1rem" }}>
                View All Orders
              </Link>
            </article>

            <article className="panel dashboard-card">
              <h3>Upcoming Catering</h3>
              {upcomingBookings.length > 0 ? (
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  {upcomingBookings.map((booking) => (
                    <div
                      key={booking.id}
                      style={{
                        padding: "0.8rem",
                        background: "rgba(3, 8, 11, 0.4)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line-soft)"
                      }}
                    >
                      <div style={{ marginBottom: "0.4rem" }}>
                        <strong style={{ color: "var(--cream)" }}>
                          {booking.packageName || "Catering Event"}
                        </strong>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)" }}>
                        {new Date(booking.eventDate).toLocaleDateString()} • {booking.partySize} guests
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--warm-gray)", marginTop: "1rem" }}>
                  No upcoming events. Planning a celebration?
                </p>
              )}
              <Link className="btn btn-secondary" href="/catering" style={{ marginTop: "1rem" }}>
                Book Catering
              </Link>
            </article>

            <article className="panel dashboard-card">
              <h3>Quick Actions</h3>
              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <Link className="btn btn-primary" href="/checkout">
                  Place New Order
                </Link>
                <Link className="btn btn-secondary" href="/catering">
                  Book Catering Event
                </Link>
                <Link className="btn btn-ghost" href="/dashboard/profile">
                  Update Profile
                </Link>
                <Link className="btn btn-ghost" href="/dashboard/payment-methods">
                  Manage Payment Methods
                </Link>
              </div>
            </article>
          </div>
        </main>
      </div>
    </>
  );
}
