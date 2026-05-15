'use client';

import { ReactNode, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { hasAnyRole, type Role } from '@/lib/roles';

interface RoleGateProps {
  allowedRoles: Role[];
  children: ReactNode;
  fallbackPath?: string;
}

export function RoleGate({ allowedRoles, children, fallbackPath = '/dashboard' }: RoleGateProps) {
  const router = useRouter();
  const { status, data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const resolvedFallbackPath =
    fallbackPath === '/dashboard' && role === 'staff'
      ? '/dashboard/orders'
      : fallbackPath === '/dashboard' && role === 'accounting'
      ? '/dashboard/payments'
      : fallbackPath;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }

    if (status === 'authenticated' && !hasAnyRole(role, allowedRoles)) {
      router.replace(resolvedFallbackPath);
    }
  }, [allowedRoles, resolvedFallbackPath, role, router, status]);

  if (status === 'loading') {
    return <div className="p-6 text-sm text-gray-400">Checking access...</div>;
  }

  if (status !== 'authenticated' || !hasAnyRole(role, allowedRoles)) {
    return null;
  }

  return <>{children}</>;
}
