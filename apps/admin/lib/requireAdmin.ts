import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { Role, hasAnyRole } from './roles';

export async function requireAdmin(allowedRoles?: Role[]) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized - No session found' },
      { status: 401 }
    );
  }

  const role = (session.user as { role?: string })?.role;

  if (!role) {
    return NextResponse.json(
      { error: 'Unauthorized - No role assigned' },
      { status: 401 }
    );
  }

  // If specific roles are required, check against them
  if (allowedRoles && allowedRoles.length > 0) {
    if (!hasAnyRole(role, allowedRoles)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }
  } else {
    // Default: allow admin and owner roles
    const defaultAllowed: Role[] = ['owner', 'admin'];
    if (!hasAnyRole(role, defaultAllowed)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }
  }

  return { session, role };
}
