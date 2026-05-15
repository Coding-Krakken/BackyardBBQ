import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import {
  canAccessDashboardPath,
  defaultDashboardForRole,
  isAdminRole,
} from "@/lib/dashboardAccess";

export default withAuth(
  function middleware(req) {
    const tokenRole = req.nextauth.token?.role;
    const pathname = req.nextUrl.pathname;

    if (!pathname.startsWith("/dashboard")) {
      return NextResponse.next();
    }

    if (!isAdminRole(tokenRole)) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    const role = tokenRole;

    if (pathname === "/dashboard" && defaultDashboardForRole(role) !== "/dashboard") {
      return NextResponse.redirect(new URL(defaultDashboardForRole(role), req.url));
    }

    if (!canAccessDashboardPath(role, pathname)) {
      return NextResponse.redirect(new URL(defaultDashboardForRole(role), req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  }
);

export const config = {
  matcher: [
    /*
     * Protect every route except:
     *  - /auth/login  (admin login page)
     *  - /api/auth/*  (NextAuth callbacks)
     *  - Next.js internals (_next/static, _next/image, favicon)
     */
    "/((?!auth/login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
