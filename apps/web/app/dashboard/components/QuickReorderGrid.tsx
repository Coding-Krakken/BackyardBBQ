"use client";

import { useState } from "react";

interface OrderItem {
  menuItemName: string;
  quantity: number;
  unitPriceCents: number;
}

interface RecentOrder {
  id: string;
  createdAt: string;
  totalCents: number;
  items: OrderItem[];
  location: {
    name: string;
  };
}

interface QuickReorderGridProps {
  recentOrders: RecentOrder[];
  onReorderSuccess?: () => void;
}

export function QuickReorderGrid({ recentOrders, onReorderSuccess }: QuickReorderGridProps) {
  const [reordering, setReordering] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleReorder = async (orderId: string) => {
    setReordering(orderId);
    setMessage(null);

    try {
      const response = await fetch("/api/customer/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: data.message || "Order placed successfully!"
        });
        
        if (onReorderSuccess) {
          onReorderSuccess();
        }

        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to reorder"
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred while reordering"
      });
    } finally {
      setReordering(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) return "Today";
    if (daysDiff === 1) return "Yesterday";
    if (daysDiff < 7) return `${daysDiff} days ago`;
    
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getItemsSummary = (items: OrderItem[]) => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const firstTwo = items.slice(0, 2).map((item) => item.menuItemName).join(", ");
    
    if (items.length > 2) {
      return `${firstTwo}, +${items.length - 2} more (${totalItems} items)`;
    }
    return `${firstTwo} (${totalItems} items)`;
  };

  if (!recentOrders || recentOrders.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Quick Reorder</h2>
          <p style={{ color: "var(--warm-gray)", marginTop: "0.25rem", fontSize: "0.95rem" }}>
            Reorder your recent favorites with one click
          </p>
        </div>
      </div>

      {message && (
        <div
          className={message.type === "success" ? "success-text" : "error-text"}
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: message.type === "success" 
              ? "rgba(34, 197, 94, 0.1)" 
              : "rgba(239, 68, 68, 0.1)",
            borderRadius: "8px",
            border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
          }}
        >
          {message.text}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1rem",
          marginTop: "1.5rem"
        }}
      >
        {recentOrders.slice(0, 6).map((order) => (
          <article key={order.id} className="panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <p style={{ fontSize: "0.85rem", color: "var(--warm-gray)" }}>
                  {formatDate(order.createdAt)}
                </p>
                <p style={{ fontSize: "0.85rem", color: "var(--brass)", marginTop: "0.25rem" }}>
                  {order.location.name}
                </p>
              </div>
              <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--ember)" }}>
                {formatPrice(order.totalCents)}
              </p>
            </div>

            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.9rem",
                color: "var(--warm-gray)",
                lineHeight: 1.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical"
              }}
            >
              {getItemsSummary(order.items)}
            </p>

            <button
              onClick={() => handleReorder(order.id)}
              disabled={reordering === order.id}
              className="btn btn-secondary"
              style={{ marginTop: "1rem", width: "100%" }}
            >
              {reordering === order.id ? "Reordering..." : "Reorder"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
