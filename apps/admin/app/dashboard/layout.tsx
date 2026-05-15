import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../../lib/auth';
import { Sidebar } from '../../components/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/login');
  }

  const role = (session.user as { role?: string })?.role;
  const allowedRoles = ['owner', 'admin', 'manager', 'staff', 'accounting'];

  if (!role || !allowedRoles.includes(role)) {
    redirect('/auth/login');
  }

  return (
    <div className="flex min-h-screen bg-bbq-dark">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
