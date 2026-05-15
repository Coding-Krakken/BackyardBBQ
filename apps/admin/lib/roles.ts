export type Role = 'owner' | 'admin' | 'manager' | 'staff' | 'accounting';

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  staff: 2,
  accounting: 2,
};

export interface RolePermissions {
  canAccessOrders: boolean;
  canAccessBookings: boolean;
  canAccessCustomers: boolean;
  canAccessMenu: boolean;
  canAccessAnalytics: boolean;
  canAccessAccounting: boolean;
  canAccessPayments: boolean;
  canAccessIntegrations: boolean;
  canAccessNotifications: boolean;
  canAccessReferrals: boolean;
  canFinalizeAccounting: boolean;
  canManageLocations: boolean;
  canManageStaff: boolean;
}

export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  owner: {
    canAccessOrders: true,
    canAccessBookings: true,
    canAccessCustomers: true,
    canAccessMenu: true,
    canAccessAnalytics: true,
    canAccessAccounting: true,
    canAccessPayments: true,
    canAccessIntegrations: true,
    canAccessNotifications: true,
    canAccessReferrals: true,
    canFinalizeAccounting: true,
    canManageLocations: true,
    canManageStaff: true,
  },
  admin: {
    canAccessOrders: true,
    canAccessBookings: true,
    canAccessCustomers: true,
    canAccessMenu: true,
    canAccessAnalytics: true,
    canAccessAccounting: true,
    canAccessPayments: true,
    canAccessIntegrations: true,
    canAccessNotifications: true,
    canAccessReferrals: true,
    canFinalizeAccounting: false,
    canManageLocations: false,
    canManageStaff: true,
  },
  manager: {
    canAccessOrders: true,
    canAccessBookings: true,
    canAccessCustomers: true,
    canAccessMenu: true,
    canAccessAnalytics: true,
    canAccessAccounting: false,
    canAccessPayments: false,
    canAccessIntegrations: false,
    canAccessNotifications: false,
    canAccessReferrals: false,
    canFinalizeAccounting: false,
    canManageLocations: false,
    canManageStaff: false,
  },
  staff: {
    canAccessOrders: true,
    canAccessBookings: true,
    canAccessCustomers: false,
    canAccessMenu: false,
    canAccessAnalytics: false,
    canAccessAccounting: false,
    canAccessPayments: false,
    canAccessIntegrations: false,
    canAccessNotifications: false,
    canAccessReferrals: false,
    canFinalizeAccounting: false,
    canManageLocations: false,
    canManageStaff: false,
  },
  accounting: {
    canAccessOrders: false,
    canAccessBookings: false,
    canAccessCustomers: false,
    canAccessMenu: false,
    canAccessAnalytics: false,
    canAccessAccounting: true,
    canAccessPayments: true,
    canAccessIntegrations: false,
    canAccessNotifications: false,
    canAccessReferrals: false,
    canFinalizeAccounting: false,
    canManageLocations: false,
    canManageStaff: false,
  },
};

export function hasPermission(role: string | undefined, permission: keyof RolePermissions): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) {
    return false;
  }
  return ROLE_PERMISSIONS[role as Role][permission];
}

export function hasAnyRole(userRole: string | undefined, allowedRoles: Role[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole as Role);
}
