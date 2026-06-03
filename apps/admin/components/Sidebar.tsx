'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebar } from '@/app/dashboard/DashboardShell';
import { RestartTourButton } from '@/components/onboarding/RestartTourButton';

interface NavItem {
  label: string;
  href: string;
  roles: string[];
  icon: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', roles: ['owner', 'admin', 'manager', 'staff', 'accounting'], icon: '◉', section: 'Main' },
  { label: 'Orders', href: '/dashboard/orders', roles: ['owner', 'admin', 'manager', 'staff'], icon: '⊞', section: 'Main' },
  { label: 'Bookings', href: '/dashboard/bookings', roles: ['owner', 'admin', 'manager', 'staff'], icon: '◈', section: 'Main' },
  { label: 'Catering', href: '/dashboard/catering', roles: ['owner', 'admin', 'manager'], icon: '⊘', section: 'Main' },
  { label: 'Customers', href: '/dashboard/customers', roles: ['owner', 'admin', 'manager'], icon: '◎', section: 'Main' },
  { label: 'Menu', href: '/dashboard/menu', roles: ['owner', 'admin', 'manager'], icon: '☰', section: 'Manage' },
  { label: 'Analytics', href: '/dashboard/analytics', roles: ['owner', 'admin', 'manager'], icon: '◑', section: 'Manage' },
  { label: 'Accounting', href: '/dashboard/accounting', roles: ['owner', 'admin', 'accounting'], icon: '◇', section: 'Finance' },
  { label: 'Payments', href: '/dashboard/payments', roles: ['owner', 'admin', 'accounting'], icon: '◆', section: 'Finance' },
  { label: 'Integrations', href: '/dashboard/integrations', roles: ['owner', 'admin'], icon: '⊕', section: 'System' },
  { label: 'Notifications', href: '/dashboard/notifications', roles: ['owner', 'admin'], icon: '◌', section: 'System' },
  { label: 'Referrals', href: '/dashboard/referrals', roles: ['owner', 'admin'], icon: '⊛', section: 'System' },
];

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname() ?? '';
  const { mobileOpen, setMobileOpen, collapsed, setCollapsed } = useSidebar();
  const userRole = (session?.user as { role?: string })?.role || 'staff';
  const userName = session?.user?.name || 'User';
  const initials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  // Group items by section
  const sections: { label: string; items: NavItem[] }[] = [];
  let lastSection = '';
  for (const item of visibleItems) {
    const section = item.section || '';
    if (section !== lastSection) {
      sections.push({ label: section, items: [item] });
      lastSection = section;
    } else {
      sections[sections.length - 1]!.items.push(item);
    }
  }

  const sidebarContent = (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">🔥</div>
        <span className="sidebar-brand-text">BBQ Admin</span>
      </div>

      {/* Collapse toggle (desktop only) */}
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? '›' : '‹'}
      </button>

      {/* Navigation */}
      <div className="sidebar-nav">
        {sections.map((section, sectionIdx) => (
          <div key={section.label || sectionIdx}>
            {sectionIdx > 0 && <div className="sidebar-divider" />}
            {!collapsed && section.label && sectionIdx > 0 && (
              <div className="sidebar-section-label">{section.label}</div>
            )}
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span className="sidebar-nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{userName}</div>
            <div className="sidebar-user-role">{userRole}</div>
          </div>
        </div>
        {!collapsed && (
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="btn btn-ghost btn-sm w-full sidebar-signout"
          >
            Sign Out
          </button>
        )}
        {(userRole === 'owner' || userRole === 'admin') && <RestartTourButton />}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {sidebarContent}
    </>
  );
}
