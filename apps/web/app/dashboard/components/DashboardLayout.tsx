"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NotificationCenter } from "./NotificationCenter";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/orders", label: "Orders", icon: "🛒" },
  { href: "/dashboard/bookings", label: "Catering", icon: "🎉" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
  { href: "/dashboard/profile", label: "Profile", icon: "👤" },
  { href: "/dashboard/referrals", label: "Referrals", icon: "🎁" },
  { href: "/dashboard/support", label: "Support", icon: "💬" }
] as const;

export function DashboardHeader() {
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth/login" });
  };

  const displayName = session?.user?.name || session?.user?.email || "Customer";

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-content">
        <Link href="/" className="dashboard-brand">
          <span className="dashboard-brand-mark">BBQ</span>
          <span className="dashboard-brand-text">Backyard BBQ King</span>
        </Link>

        <div className="dashboard-header-actions">
          <Link href="/" className="btn btn-ghost">
            Back to Site
          </Link>

          <NotificationCenter />

          <div className="user-menu">
            <button
              className="user-menu-trigger"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-label="User menu"
              aria-expanded={userMenuOpen}
            >
              <span className="user-avatar">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <span className="user-name">{displayName}</span>
            </button>

            {userMenuOpen && (
              <div className="user-menu-dropdown">
                <Link href="/dashboard/profile" onClick={() => setUserMenuOpen(false)}>
                  Profile Settings
                </Link>
                <button onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="dashboard-sidebar">
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dashboard-nav-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="dashboard-nav-icon">{item.icon}</span>
              <span className="dashboard-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
