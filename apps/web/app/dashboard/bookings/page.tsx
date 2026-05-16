"use client";

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader, DashboardSidebar } from "../components/DashboardLayout";
import { OrderListSkeleton } from "../components/SkeletonLoader";
import { BookingStatusTimeline } from "../components/OrderStatusTimeline";

interface Booking {
  id: string;
  eventDate: string;
  partySize: number;
  eventAddress?: string;
  packageName?: string;
  status: string;
  estimatedTotalCents?: number;
  depositCents?: number;
  finalPaymentCents?: number;
  depositPaidCents?: number;
  depositDueCents?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  location: {
    id: string;
    name: string;
    type: string;
  };
}

export default function BookingsPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchBookings();
    }
  }, [sessionStatus]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/customer/bookings?limit=100");
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      }
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBookingExpanded = (bookingId: string) => {
    setExpandedBookings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

  const upcomingBookings = bookings.filter((booking) => {
    const eventDate = new Date(booking.eventDate);
    const now = new Date();
    return eventDate >= now && ["pending_approval", "approved"].includes(booking.status);
  });

  const pastBookings = bookings.filter((booking) => {
    const eventDate = new Date(booking.eventDate);
    const now = new Date();
    return (
      eventDate < now ||
      ["cancelled", "declined", "draft"].includes(booking.status)
    );
  });

  if (sessionStatus === "loading" || loading) {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <h1 style={{ marginBottom: "2rem" }}>🎉 Catering Bookings</h1>
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
            <h1>Catering Bookings</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              Manage your upcoming events and view past catering bookings.
            </p>
          </section>

          {upcomingBookings.length > 0 && (
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>Upcoming Events ({upcomingBookings.length})</h2>
                <Link href="/catering" className="btn btn-primary">
                  New Booking
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {upcomingBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    isExpanded={expandedBookings.has(booking.id)}
                    onToggle={() => toggleBookingExpanded(booking.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <h2>Past Bookings ({pastBookings.length})</h2>
            </div>
            {pastBookings.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {pastBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    isExpanded={expandedBookings.has(booking.id)}
                    onToggle={() => toggleBookingExpanded(booking.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
                <p style={{ color: "var(--warm-gray)", fontSize: "1.1rem", marginBottom: "1rem" }}>
                  {upcomingBookings.length > 0
                    ? "No past bookings."
                    : "No catering bookings yet."}
                </p>
                <Link href="/catering" className="btn btn-primary">
                  Book Your First Event
                </Link>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

function BookingCard({
  booking,
  isExpanded,
  onToggle
}: {
  booking: Booking;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  const getDaysUntil = (dateString: string) => {
    const eventDate = new Date(dateString);
    const now = new Date();
    const diff = eventDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const daysUntil = getDaysUntil(booking.eventDate);
  const isUpcoming = daysUntil >= 0;

  return (
    <article className="panel">
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
              {booking.packageName || "Catering Event"}
            </h3>
            {isUpcoming && daysUntil <= 7 && (
              <span
                style={{
                  padding: "0.25rem 0.6rem",
                  background: "rgba(217, 109, 49, 0.2)",
                  border: "1px solid rgba(217, 109, 49, 0.5)",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  color: "var(--ember-soft)",
                  fontWeight: 600
                }}
              >
                {daysUntil === 0 ? "TODAY" : `${daysUntil} DAYS`}
              </span>
            )}
          </div>
          <div style={{ fontSize: "1rem", color: "var(--cream)", marginBottom: "0.4rem", fontWeight: 500 }}>
            📅 {formatDate(booking.eventDate)}
          </div>
          <div style={{ fontSize: "0.9rem", color: "var(--warm-gray)", marginBottom: "0.3rem" }}>
            👥 {booking.partySize} guests • {booking.location.name}
          </div>
          {booking.eventAddress && (
            <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)" }}>
              📍 {booking.eventAddress}
            </div>
          )}
        </div>
        {booking.estimatedTotalCents && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--ember-soft)" }}>
              ${(booking.estimatedTotalCents / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--warm-gray)", marginTop: "0.2rem" }}>
              Estimated total
            </div>
          </div>
        )}
      </div>

      <BookingStatusTimeline status={booking.status} />

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button className="btn btn-secondary" onClick={onToggle} style={{ flex: "1", minWidth: "120px" }}>
          {isExpanded ? "Hide Details" : "View Details"}
        </button>
        {booking.status === "approved" && (
          <>
            {(booking.depositDueCents ?? booking.depositCents ?? 0) > 0 ? (
              <Link
                href={`/catering/bookings/${booking.id}/deposit`}
                className="btn btn-primary"
                style={{ flex: "1", minWidth: "160px" }}
              >
                Pay Deposit
              </Link>
            ) : null}
            <Link href="/catering" className="btn btn-ghost" style={{ flex: "1", minWidth: "120px" }}>
              Modify Booking
            </Link>
          </>
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
          <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1rem" }}>Event Details</h4>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0" }}>
              <span style={{ color: "var(--warm-gray)" }}>Event Date</span>
              <span style={{ color: "var(--cream)", fontWeight: 500 }}>{formatDate(booking.eventDate)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0" }}>
              <span style={{ color: "var(--warm-gray)" }}>Party Size</span>
              <span style={{ color: "var(--cream)", fontWeight: 500 }}>{booking.partySize} guests</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0" }}>
              <span style={{ color: "var(--warm-gray)" }}>Location</span>
              <span style={{ color: "var(--cream)", fontWeight: 500 }}>{booking.location.name}</span>
            </div>
            {booking.eventAddress && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0" }}>
                <span style={{ color: "var(--warm-gray)" }}>Event Address</span>
                <span style={{ color: "var(--cream)", fontWeight: 500, textAlign: "right" }}>
                  {booking.eventAddress}
                </span>
              </div>
            )}
            {booking.notes && (
              <div style={{ padding: "0.6rem 0" }}>
                <div style={{ color: "var(--warm-gray)", marginBottom: "0.4rem" }}>Special Requests</div>
                <div
                  style={{
                    color: "var(--cream)",
                    background: "rgba(255, 255, 255, 0.03)",
                    padding: "0.8rem",
                    borderRadius: "6px",
                    fontSize: "0.9rem"
                  }}
                >
                  {booking.notes}
                </div>
              </div>
            )}
          </div>

          {(booking.depositCents || booking.finalPaymentCents || booking.estimatedTotalCents) && (
            <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
              <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "0.95rem" }}>Payment Schedule</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {booking.depositCents && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--warm-gray)" }}>Deposit</span>
                    <span style={{ color: "var(--ember-soft)", fontWeight: 600 }}>
                      ${(booking.depositCents / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                {typeof booking.depositPaidCents === "number" ? (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--warm-gray)" }}>Deposit Paid</span>
                    <span style={{ color: "var(--cream)", fontWeight: 500 }}>
                      ${(booking.depositPaidCents / 100).toFixed(2)}
                    </span>
                  </div>
                ) : null}
                {typeof booking.depositDueCents === "number" ? (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--warm-gray)" }}>Deposit Due</span>
                    <span style={{ color: "var(--ember-soft)", fontWeight: 600 }}>
                      ${(booking.depositDueCents / 100).toFixed(2)}
                    </span>
                  </div>
                ) : null}
                {booking.finalPaymentCents && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--warm-gray)" }}>Final Payment</span>
                    <span style={{ color: "var(--cream)", fontWeight: 500 }}>
                      ${(booking.finalPaymentCents / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                {booking.estimatedTotalCents && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "0.5rem",
                      paddingTop: "0.8rem",
                      borderTop: "1px solid var(--line-soft)",
                      fontSize: "1.05rem",
                      fontWeight: 600
                    }}
                  >
                    <span style={{ color: "var(--cream)" }}>Estimated Total</span>
                    <span style={{ color: "var(--ember-soft)" }}>
                      ${(booking.estimatedTotalCents / 100).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: "1.5rem",
              padding: "0.8rem",
              background: "rgba(217, 109, 49, 0.1)",
              border: "1px solid rgba(217, 109, 49, 0.3)",
              borderRadius: "6px",
              fontSize: "0.85rem",
              color: "var(--warm-gray)"
            }}
          >
            <strong style={{ color: "var(--ember-soft)" }}>Booking ID:</strong> {booking.id.slice(0, 12)}
            <br />
            <strong style={{ color: "var(--ember-soft)" }}>Created:</strong>{" "}
            {new Date(booking.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </article>
  );
}
