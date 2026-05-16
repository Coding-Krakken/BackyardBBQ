"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, PanInfo } from "framer-motion";
import { DashboardHeader, DashboardSidebar } from "../components/DashboardLayout";
import { OrderStatusTimeline } from "../components/OrderStatusTimeline";
import { OrderListSkeleton } from "../components/SkeletonLoader";

interface Order {
  id: string;
  status: string;
  source: string;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    menuItemName: string;
    quantity: number;
    unitPriceCents: number;
    notes?: string;
  }>;
  location: {
    id: string;
    name: string;
    type: string;
  };
  payment?: {
    status: string;
    amountCents: number;
  };
}

export default function OrdersPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [reordering, setReordering] = useState<string | null>(null);
  const [reorderMessage, setReorderMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchOrders();
    }
  }, [sessionStatus, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      params.set("limit", "100");

      const response = await fetch(`/api/customer/orders?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleReorder = async (orderId: string) => {
    setReordering(orderId);
    setReorderMessage(null);

    try {
      const response = await fetch("/api/customer/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });

      const data = await response.json();

      if (response.ok) {
        setReorderMessage({
          type: "success",
          text: data.message || "Order placed successfully!"
        });
        
        // Refresh orders list
        fetchOrders();

        // Clear message after 5 seconds
        setTimeout(() => setReorderMessage(null), 5000);
      } else {
        setReorderMessage({
          type: "error",
          text: data.error || "Failed to reorder"
        });
      }
    } catch (error) {
      setReorderMessage({
        type: "error",
        text: "An error occurred while reordering"
      });
    } finally {
      setReordering(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.id.toLowerCase().includes(query) ||
      order.items.some((item) => item.menuItemName.toLowerCase().includes(query)) ||
      order.location.name.toLowerCase().includes(query) ||
      (order.totalCents / 100).toFixed(2).includes(query)
    );
  });

  const activeOrders = filteredOrders.filter((order) =>
    ["pending", "confirmed", "preparing", "ready"].includes(order.status)
  );

  const pastOrders = filteredOrders.filter((order) =>
    ["completed", "cancelled"].includes(order.status)
  );

  if (sessionStatus === "loading" || loading) {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <h1 style={{ marginBottom: "2rem" }}>🛒 Order History</h1>
            <OrderListSkeleton />
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader />
      <div className="dashboard-container">
        <DashboardSidebar />
        <main id="main-content" className="dashboard-main">
          <section className="dashboard-section">
            <h1>Order History</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              Track all your orders, view details, and reorder your favorites.
            </p>
          </section>

          {reorderMessage && (
            <div
              className={reorderMessage.type === "success" ? "success-text" : "error-text"}
              style={{
                marginTop: "-1rem",
                marginBottom: "1.5rem",
                padding: "0.75rem 1rem",
                background: reorderMessage.type === "success" 
                  ? "rgba(34, 197, 94, 0.1)" 
                  : "rgba(239, 68, 68, 0.1)",
                borderRadius: "8px",
                border: `1px solid ${reorderMessage.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
              }}
            >
              {reorderMessage.text}
            </div>
          )}

          <section className="dashboard-section">
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
              <div style={{ flex: "1", minWidth: "200px" }}>
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.7rem 1rem",
                    background: "rgba(3, 8, 11, 0.75)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--cream)",
                    fontSize: "0.95rem"
                  }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "0.7rem 1rem",
                  background: "rgba(3, 8, 11, 0.75)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--cream)",
                  fontSize: "0.95rem",
                  minWidth: "150px"
                }}
              >
                <option value="all">All Orders</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </section>

          {activeOrders.length > 0 && (
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>Active Orders ({activeOrders.length})</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {activeOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isExpanded={expandedOrders.has(order.id)}
                    onToggle={() => toggleOrderExpanded(order.id)}
                    onReorder={handleReorder}
                    isReordering={reordering === order.id}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h2>Past Orders ({pastOrders.length})</h2>
            </div>
            {pastOrders.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {pastOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isExpanded={expandedOrders.has(order.id)}
                    onToggle={() => toggleOrderExpanded(order.id)}
                    onReorder={handleReorder}
                    isReordering={reordering === order.id}
                  />
                ))}
              </div>
            ) : (
              <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
                <p style={{ color: "var(--warm-gray)", fontSize: "1.1rem" }}>
                  {searchQuery || statusFilter !== "all"
                    ? "No orders match your search."
                    : "No past orders yet. Place your first order!"}
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

function OrderCard({
  order,
  isExpanded,
  onToggle,
  onReorder,
  isReordering
}: {
  order: Order;
  isExpanded: boolean;
  onToggle: () => void;
  onReorder: (orderId: string) => void;
  isReordering: boolean;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      direct: { label: "Direct", color: "var(--ember)" },
      doordash: { label: "DoorDash", color: "#FF3008" },
      ubereats: { label: "Uber Eats", color: "#06C167" },
      grubhub: { label: "Grubhub", color: "#F63440" },
      catering: { label: "Catering", color: "var(--brass)" }
    };
    const badge = badges[source] || { label: source, color: "var(--warm-gray)" };
    return (
      <span
        style={{
          padding: "0.25rem 0.6rem",
          background: `${badge.color}22`,
          border: `1px solid ${badge.color}55`,
          borderRadius: "6px",
          fontSize: "0.75rem",
          color: badge.color,
          fontWeight: 600,
          textTransform: "uppercase"
        }}
      >
        {badge.label}
      </span>
    );
  };

  const [dragX, setDragX] = useState(0);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // If dragged significantly to the right (> 100px), trigger reorder
    if (info.offset.x > 100 && order.status === "completed") {
      onReorder(order.id);
    }
    setDragX(0);
  };

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Action indicator background */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "100px",
          background: "linear-gradient(90deg, rgba(217, 109, 49, 0.2), transparent)",
          display: "flex",
          alignItems: "center",
          paddingLeft: "1rem",
          opacity: dragX > 0 ? Math.min(dragX / 100, 1) : 0,
          transition: "opacity 0.2s",
          pointerEvents: "none",
          zIndex: 0
        }}
      >
        <span style={{ color: "var(--ember)", fontSize: "1.5rem" }}>🔄</span>
      </div>

      <motion.article
        className="panel"
        drag="x"
        dragConstraints={{ left: 0, right: order.status === "completed" ? 150 : 0 }}
        dragElastic={0.2}
        onDrag={(e, info) => setDragX(info.offset.x)}
        onDragEnd={handleDragEnd}
        style={{
          touchAction: "pan-y", // Allow vertical scrolling while dragging horizontally
          position: "relative",
          zIndex: 1
        }}
      >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1rem"
        }}
      >
        <div style={{ flex: "1", minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem" }}>
              {order.items[0]?.menuItemName || "Order"}
              {order.items.length > 1 && ` +${order.items.length - 1} more`}
            </h3>
            {getSourceBadge(order.source)}
          </div>
          <div style={{ fontSize: "0.9rem", color: "var(--warm-gray)", marginBottom: "0.3rem" }}>
            {order.location.name} • {formatDate(order.createdAt)}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)" }}>
            Order #{order.id.slice(0, 8)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--ember-soft)" }}>
            ${(order.totalCents / 100).toFixed(2)}
          </div>
          {order.payment && (
            <div style={{ fontSize: "0.8rem", color: "var(--warm-gray)", marginTop: "0.2rem" }}>
              Payment: {order.payment.status}
            </div>
          )}
        </div>
      </div>

      <OrderStatusTimeline
        status={order.status}
        createdAt={order.createdAt}
        updatedAt={order.updatedAt}
      />

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button className="btn btn-secondary" onClick={onToggle} style={{ flex: "1", minWidth: "120px" }}>
          {isExpanded ? "Hide Details" : "View Details"}
        </button>
        {order.status === "completed" && (
          <button 
            className="btn btn-ghost" 
            style={{ flex: "1", minWidth: "120px" }}
            onClick={() => onReorder(order.id)}
            disabled={isReordering}
          >
            {isReordering ? "Reordering..." : "Reorder"}
          </button>
        )}
      </div>

      {isExpanded && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            background: "rgba(3, 8, 11, 0.4)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line-soft)"
          }}
        >
          <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1rem" }}>Order Items</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.6rem 0",
                  borderBottom: "1px solid var(--line-soft)"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: "var(--cream)" }}>
                    {item.quantity}x {item.menuItemName}
                  </div>
                  {item.notes && (
                    <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)", marginTop: "0.2rem" }}>
                      Note: {item.notes}
                    </div>
                  )}
                </div>
                <div style={{ color: "var(--ember-soft)", fontWeight: 600 }}>
                  ${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
              <span style={{ color: "var(--warm-gray)" }}>Subtotal</span>
              <span style={{ color: "var(--cream)" }}>${(order.subtotalCents / 100).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
              <span style={{ color: "var(--warm-gray)" }}>Tax</span>
              <span style={{ color: "var(--cream)" }}>${(order.taxCents / 100).toFixed(2)}</span>
            </div>
            {order.tipCents > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ color: "var(--warm-gray)" }}>Tip</span>
                <span style={{ color: "var(--cream)" }}>${(order.tipCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "0.8rem",
                paddingTop: "0.8rem",
                borderTop: "1px solid var(--line)",
                fontSize: "1.1rem",
                fontWeight: 600
              }}
            >
              <span style={{ color: "var(--cream)" }}>Total</span>
              <span style={{ color: "var(--ember-soft)" }}>${(order.totalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
      </motion.article>
    </div>
  );
}
