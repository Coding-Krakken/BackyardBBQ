import dashboardAccessRules from '@/config/dashboard-access-rules.json';
import type { Role } from '@/lib/roles';

interface RoleDashboardAccessRule {
  defaultDashboard: string;
  fullDashboardAccess: boolean;
  dashboardPrefixes: string[];
}

interface DashboardAccessRules {
  roles: Record<Role, RoleDashboardAccessRule>;
}

const rules = dashboardAccessRules as DashboardAccessRules;

export const DASHBOARD_ACCESS_RULES = rules.roles;

export function isAdminRole(value: unknown): value is Role {
  return typeof value === 'string' && value in DASHBOARD_ACCESS_RULES;
}

export function defaultDashboardForRole(role: Role): string {
  return DASHBOARD_ACCESS_RULES[role].defaultDashboard;
}

export function canAccessDashboardPath(role: Role, pathname: string): boolean {
  const accessRule = DASHBOARD_ACCESS_RULES[role];

  if (accessRule.fullDashboardAccess) {
    return pathname.startsWith('/dashboard');
  }

  if (pathname === '/dashboard') {
    return true;
  }

  return accessRule.dashboardPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
