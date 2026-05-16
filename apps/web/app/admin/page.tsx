import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy admin route - redirects to the new dedicated admin app.
 * The admin dashboard has been migrated to apps/admin/ and deployed separately.
 */
export default function OldAdminPage() {
  // Redirect to the admin app URL (defaults to localhost:3001 in development)
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001';
  permanentRedirect(adminUrl);
}