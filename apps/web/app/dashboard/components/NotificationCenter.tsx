"use client";

import { useState, useEffect, useRef, memo } from "react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export const NotificationCenter = memo(function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();

    // Poll for new notifications every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/customer/notifications?limit=10");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch("/api/customer/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId })
      });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/customer/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true })
      });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
    setIsOpen(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      order_update: "📦",
      booking_update: "🍖",
      payment_update: "💳",
      referral_reward: "🎁",
      promotional: "🔔"
    };
    return icons[type] || "🔔";
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          position: "relative",
          background: "transparent",
          border: "1px solid var(--line-soft)",
          borderRadius: "8px",
          padding: "0.6rem 0.8rem",
          cursor: "pointer",
          color: "var(--cream)",
          fontSize: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(217, 109, 49, 0.1)";
          e.currentTarget.style.borderColor = "var(--ember)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "var(--line-soft)";
        }}
      >
        <span role="img" aria-label="Bell icon">🔔</span>
        {unreadCount > 0 && (
          <span 
            aria-live="polite"
            aria-atomic="true"
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: "var(--ember)",
              color: "var(--bg-charcoal)",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              fontSize: "0.7rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          role="dialog"
          aria-label="Notification center"
          style={{
            position: "absolute",
            top: "calc(100% + 0.5rem)",
            right: 0,
            width: "380px",
            maxWidth: "calc(100vw - 2rem)",
            background: "var(--bg-charcoal)",
            border: "1px solid var(--line-soft)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
            zIndex: 1000,
            maxHeight: "500px",
            display: "flex",
            flexDirection: "column"
          }}>
          {/* Header */}
          <div style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <h4 style={{ margin: 0, color: "var(--cream)" }}>Notifications</h4>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--ember)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  padding: "0.25rem 0.5rem"
                }}
              >
                {loading ? "..." : "Mark all read"}
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            maxHeight: "400px"
          }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: "3rem 1.5rem",
                textAlign: "center",
                color: "var(--warm-gray)"
              }}>
                <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔔</p>
                <p style={{ margin: 0 }}>No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      width: "100%",
                      padding: "1rem 1.25rem",
                      background: notification.read 
                        ? "transparent" 
                        : "rgba(217, 109, 49, 0.08)",
                      border: "none",
                      borderBottom: "1px solid var(--line-soft)",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      position: "relative"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(217, 109, 49, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = notification.read 
                        ? "transparent" 
                        : "rgba(217, 109, 49, 0.08)";
                    }}
                  >
                    {!notification.read && (
                      <span style={{
                        position: "absolute",
                        left: "0.5rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "var(--ember)"
                      }} />
                    )}
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          color: "var(--cream)",
                          fontWeight: notification.read ? 400 : 600,
                          marginBottom: "0.25rem"
                        }}>
                          {notification.title}
                        </div>
                        <div style={{
                          color: "var(--warm-gray)",
                          fontSize: "0.9rem",
                          lineHeight: 1.4,
                          marginBottom: "0.5rem"
                        }}>
                          {notification.message}
                        </div>
                        <div style={{
                          color: "var(--warm-gray)",
                          fontSize: "0.8rem"
                        }}>
                          {formatDate(notification.createdAt)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
