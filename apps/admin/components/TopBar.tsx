'use client';

import { useSession } from 'next-auth/react';
import { useSidebar } from '@/app/dashboard/DashboardShell';

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const { data: session } = useSession();
  const { setMobileOpen } = useSidebar();
  const userRole = (session?.user as { role?: string })?.role || 'staff';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="topbar-hamburger"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        {title && <span className="topbar-title">{title}</span>}
      </div>
      <div className="topbar-right">
        <span className={`badge badge-${userRole === 'owner' ? 'purple' : userRole === 'admin' ? 'info' : userRole === 'manager' ? 'success' : userRole === 'accounting' ? 'brass' : 'default'}`}>
          {userRole.toUpperCase()}
        </span>
      </div>
    </header>
  );
}
