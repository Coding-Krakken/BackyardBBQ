'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@tremor/react';

interface NavItem {
  label: string;
  href: string;
  roles: string[]; // Which roles can see this nav item
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', roles: ['owner', 'admin', 'manager', 'staff', 'accounting'] },
  { label: 'Orders', href: '/dashboard/orders', roles: ['owner', 'admin', 'manager', 'staff'] },
  { label: 'Bookings', href: '/dashboard/bookings', roles: ['owner', 'admin', 'manager', 'staff'] },
  { label: 'Customers', href: '/dashboard/customers', roles: ['owner', 'admin', 'manager'] },
  { label: 'Menu', href: '/dashboard/menu', roles: ['owner', 'admin', 'manager'] },
  { label: 'Analytics', href: '/dashboard/analytics', roles: ['owner', 'admin', 'manager'] },
  { label: 'Accounting', href: '/dashboard/accounting', roles: ['owner', 'admin', 'accounting'] },
  { label: 'Payments', href: '/dashboard/payments', roles: ['owner', 'admin', 'accounting'] },
  { label: 'Integrations', href: '/dashboard/integrations', roles: ['owner', 'admin'] },
  { label: 'Notifications', href: '/dashboard/notifications', roles: ['owner', 'admin'] },
  { label: 'Referrals', href: '/dashboard/referrals', roles: ['owner', 'admin'] },
];

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRole = (session?.user as { role?: string })?.role || 'staff';

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(userRole));

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'purple';
      case 'admin': return 'blue';
      case 'manager': return 'green';
      case 'accounting': return 'amber';
      default: return 'gray';
    }
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r border-gray-800 bg-gray-950 p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-bbq-light">BBQ Admin</h1>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-gray-400">{session?.user?.name}</span>
          <Badge color={getRoleBadgeColor(userRole)} size="xs">
            {userRole}
          </Badge>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-bbq-orange text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: '/auth/login' })}
        className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
      >
        Sign Out
      </button>
    </div>
  );
}
