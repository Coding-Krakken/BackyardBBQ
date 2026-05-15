export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect every route except:
     *  - /auth/login  (admin login page)
     *  - /api/auth/*  (NextAuth callbacks)
     *  - Next.js internals (_next/static, _next/image, favicon)
     */
    "/((?!auth/login|api/auth|_next/static|_next/image|favicon.ico).*)"
  ]
};
