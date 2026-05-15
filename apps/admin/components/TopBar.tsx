'use client';

import { Badge } from '@tremor/react';
import { useSession } from 'next-auth/react';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || 'staff';

  return (
    <div className="border-b border-gray-800 bg-gray-950 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-bbq-light">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
        </div>
        <Badge color="gray" size="sm">
          {userRole.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}
