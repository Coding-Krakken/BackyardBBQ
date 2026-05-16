"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader, DashboardSidebar } from "../components/DashboardLayout";

interface Referral {
  id: string;
  refereeEmail: string | null;
  refereeName: string | null;
  status: string;
  rewardCents: number;
  rewardClaimed: boolean;
  claimedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface ReferralStats {
  totalReferrals: number;
  signedUpCount: number;
  rewardedCount: number;
  totalEarnedCents: number;
  pendingRewardsCents: number;
  referralCode: string;
}

export default function ReferralsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referralLink, setReferralLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchReferrals();
      fetchReferralCode();
    }
  }, [status]);

  const fetchReferrals = async () => {
    try {
      const response = await fetch("/api/customer/referrals");
      if (response.ok) {
        const data = await response.json();
        setReferrals(data.referrals || []);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch referrals:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralCode = async () => {
    try {
      const response = await fetch("/api/customer/referrals/code");
      if (response.ok) {
        const data = await response.json();
        setReferralLink(data.referralLink);
      }
    } catch (error) {
      console.error("Failed to fetch referral code:", error);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent("Try Backyard BBQ King - Get $5 off!");
    const body = encodeURIComponent(
      `I thought you'd love Backyard BBQ King! They have amazing BBQ and catering.\n\nSign up using my link to get $5 off your first order:\n${referralLink}\n\nEnjoy!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingInvite(true);
    setInviteMessage(null);

    try {
      const response = await fetch("/api/customer/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refereeEmail: sendEmail })
      });

      const data = await response.json();

      if (response.ok) {
        setInviteMessage({
          type: "success",
          text: "Referral invitation sent successfully!"
        });
        setSendEmail("");
        fetchReferrals(); // Refresh list
        setTimeout(() => setInviteMessage(null), 5000);
      } else {
        setInviteMessage({
          type: "error",
          text: data.error || "Failed to send invitation"
        });
      }
    } catch (error) {
      setInviteMessage({
        type: "error",
        text: "An error occurred"
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      pending: { color: "var(--warm-gray)", label: "Pending" },
      signed_up: { color: "var(--brass)", label: "Signed Up" },
      rewarded: { color: "var(--ember)", label: "Rewarded" },
      expired: { color: "#6b7280", label: "Expired" }
    };

    const badge = badges[status] ?? { color: "var(--warm-gray)", label: "Unknown" };
    return (
      <span style={{
        padding: "0.25rem 0.75rem",
        borderRadius: "12px",
        fontSize: "0.85rem",
        fontWeight: 500,
        background: `${badge.color}33`,
        color: badge.color,
        border: `1px solid ${badge.color}66`
      }}>
        {badge.label}
      </span>
    );
  };

  if (status === "loading" || loading) {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <p style={{ color: "var(--warm-gray)" }}>Loading...</p>
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
            <h1>Referral Program</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              Invite friends and earn rewards when they order
            </p>
          </section>

          {/* Stats Cards */}
          {stats && (
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-value">{stats.totalReferrals}</div>
                <div className="stat-label">Total Referrals</div>
              </article>
              <article className="stat-card">
                <div className="stat-value">{stats.signedUpCount}</div>
                <div className="stat-label">Signed Up</div>
              </article>
              <article className="stat-card">
                <div className="stat-value">{formatCurrency(stats.totalEarnedCents)}</div>
                <div className="stat-label">Total Earned</div>
              </article>
              <article className="stat-card">
                <div className="stat-value" style={{ color: "var(--ember)" }}>
                  {formatCurrency(stats.pendingRewardsCents)}
                </div>
                <div className="stat-label">Pending Rewards</div>
              </article>
            </div>
          )}

          {/* Share Your Link */}
          <article className="panel">
            <h3>Share Your Referral Link</h3>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem", marginBottom: "1.5rem" }}>
              Invite friends to Backyard BBQ King. They get <strong style={{ color: "var(--ember)" }}>$5 off</strong> their first order, 
              and you get <strong style={{ color: "var(--brass)" }}>$10 credit</strong> after they order!
            </p>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
                Your Referral Code
              </label>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  type="text"
                  value={stats?.referralCode || ""}
                  readOnly
                  style={{
                    flex: 1,
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textAlign: "center",
                    background: "rgba(3, 8, 11, 0.6)",
                    color: "var(--ember)"
                  }}
                />
                <button
                  onClick={handleCopyLink}
                  className="btn btn-secondary"
                  style={{ minWidth: "120px" }}
                >
                  {copied ? "✓ Copied!" : "Copy Link"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
              <button
                onClick={handleShareEmail}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                📧 Share via Email
              </button>
              <button
                onClick={handleCopyLink}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                🔗 Copy Link
              </button>
            </div>

            {/* Send Direct Invitation */}
            <div style={{
              padding: "1.5rem",
              background: "rgba(3, 8, 11, 0.4)",
              borderRadius: "8px",
              border: "1px solid var(--line-soft)"
            }}>
              <h4 style={{ marginBottom: "0.75rem" }}>Send Direct Invitation</h4>
              <form onSubmit={handleSendInvite} style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="friend@example.com"
                  required
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sendingInvite}
                  style={{ minWidth: "140px" }}
                >
                  {sendingInvite ? "Sending..." : "Send Invite"}
                </button>
              </form>
              {inviteMessage && (
                <p
                  className={inviteMessage.type === "success" ? "success-text" : "error-text"}
                  style={{ marginTop: "0.75rem", marginBottom: 0 }}
                >
                  {inviteMessage.text}
                </p>
              )}
            </div>
          </article>

          {/* Referral History */}
          <article className="panel">
            <h3>Referral History</h3>
            {referrals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--warm-gray)" }}>
                <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No referrals yet</p>
                <p>Start sharing your referral link to earn rewards!</p>
              </div>
            ) : (
              <div style={{ marginTop: "1.5rem" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--line-soft)" }}>
                        <th style={{ padding: "0.75rem", textAlign: "left", color: "var(--warm-gray)", fontWeight: 500 }}>
                          Friend
                        </th>
                        <th style={{ padding: "0.75rem", textAlign: "left", color: "var(--warm-gray)", fontWeight: 500 }}>
                          Status
                        </th>
                        <th style={{ padding: "0.75rem", textAlign: "left", color: "var(--warm-gray)", fontWeight: 500 }}>
                          Reward
                        </th>
                        <th style={{ padding: "0.75rem", textAlign: "left", color: "var(--warm-gray)", fontWeight: 500 }}>
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((referral) => (
                        <tr
                          key={referral.id}
                          style={{ borderBottom: "1px solid var(--line-soft)" }}
                        >
                          <td style={{ padding: "1rem 0.75rem" }}>
                            <div>
                              <div style={{ color: "var(--cream)", fontWeight: 500 }}>
                                {referral.refereeName || referral.refereeEmail || "Pending"}
                              </div>
                              {referral.refereeName && referral.refereeEmail && (
                                <div style={{ fontSize: "0.85rem", color: "var(--warm-gray)", marginTop: "0.25rem" }}>
                                  {referral.refereeEmail}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "1rem 0.75rem" }}>
                            {getStatusBadge(referral.status)}
                          </td>
                          <td style={{ padding: "1rem 0.75rem" }}>
                            {referral.status === "rewarded" ? (
                              <span style={{ color: "var(--ember)", fontWeight: 600 }}>
                                {formatCurrency(referral.rewardCents)}
                              </span>
                            ) : (
                              <span style={{ color: "var(--warm-gray)" }}>
                                {formatCurrency(referral.rewardCents)}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "1rem 0.75rem", color: "var(--warm-gray)" }}>
                            {formatDate(referral.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </article>

          {/* How It Works */}
          <article className="panel" style={{ background: "rgba(217, 109, 49, 0.1)", border: "1px solid rgba(217, 109, 49, 0.3)" }}>
            <h3>How It Works</h3>
            <div style={{ marginTop: "1.5rem", display: "grid", gap: "1.25rem" }}>
              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--ember)",
                  color: "var(--bg-charcoal)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  flexShrink: 0
                }}>
                  1
                </div>
                <div>
                  <h4 style={{ marginBottom: "0.25rem" }}>Share Your Link</h4>
                  <p style={{ color: "var(--warm-gray)", margin: 0 }}>
                    Send your unique referral link to friends via email, text, or social media
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--ember)",
                  color: "var(--bg-charcoal)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  flexShrink: 0
                }}>
                  2
                </div>
                <div>
                  <h4 style={{ marginBottom: "0.25rem" }}>They Sign Up</h4>
                  <p style={{ color: "var(--warm-gray)", margin: 0 }}>
                    Your friend creates an account using your link and gets $5 off their first order
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--ember)",
                  color: "var(--bg-charcoal)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  flexShrink: 0
                }}>
                  3
                </div>
                <div>
                  <h4 style={{ marginBottom: "0.25rem" }}>You Both Win!</h4>
                  <p style={{ color: "var(--warm-gray)", margin: 0 }}>
                    After their first order, you receive $10 in credit automatically applied to your account
                  </p>
                </div>
              </div>
            </div>
          </article>
        </main>
      </div>
    </>
  );
}
