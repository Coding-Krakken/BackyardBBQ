import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../../lib/auth';
import { Sidebar } from '../../components/Sidebar';
import { TopBar } from '../../components/TopBar';
import { DashboardShell } from './DashboardShell';

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
    <DashboardShell>
      <Sidebar />
      <div className="admin-main">
        <TopBar />
        <main className="admin-content">
          {children}
        </main>
      </div>
    </DashboardShell>
  );
}
