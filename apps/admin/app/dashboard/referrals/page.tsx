'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { fetcher, formatCurrency, formatDate } from '@/lib/utils';

interface Referral {
  id: string;
  referrerEmail: string;
  refereeEmail: string;
  status: string;
  rewardCents: number;
  createdAt: string;
}

const REFERRAL_STATUSES = ['pending', 'completed', 'rewarded', 'expired'];

export default function ReferralsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; action: 'reward' | 'expire' } | null>(null);
  const { addToast } = useToast();

  const { data, mutate, isLoading } = useSWR<{ data: Referral[] }>('/api/admin/referrals', fetcher);

  const filteredReferrals = (data?.data ?? []).filter((r) =>
    activeTab === 'all' ? true : r.status === activeTab
  );

  const handleAction = async (id: string, action: 'reward' | 'expire') => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/referrals/${id}/${action}`, { method: 'POST' });
      if (response.ok) {
        addToast({ type: 'success', message: `Referral ${action === 'reward' ? 'rewarded' : 'expired'}` });
        await mutate();
      } else {
        addToast({ type: 'error', message: 'Action failed' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsProcessing(false);
      setConfirmTarget(null);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin']}>
      <AnimatedPage>
        <PageHeader title="Referrals" subtitle="Manage customer referral rewards" />

        <div className="tabs mb-lg">
          <button className={`tab ${activeTab === 'all' ? 'tab-active' : ''}`} onClick={() => setActiveTab('all')}>All</button>
          {REFERRAL_STATUSES.map((s) => (
            <button key={s} className={`tab ${activeTab === s ? 'tab-active' : ''}`} onClick={() => setActiveTab(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="panel">
          <DataTable
            columns={[
              { header: 'ID', accessor: (row: Referral) => row.id.slice(0, 8) },
              { header: 'Referrer', accessor: (row: Referral) => row.referrerEmail, sortKey: (row: Referral) => row.referrerEmail },
              { header: 'Referee', accessor: (row: Referral) => row.refereeEmail, sortKey: (row: Referral) => row.refereeEmail },
              { header: 'Status', accessor: (row: Referral) => <StatusBadge status={row.status} />, sortKey: (row: Referral) => row.status },
              { header: 'Reward', accessor: (row: Referral) => formatCurrency(row.rewardCents), sortKey: (row: Referral) => row.rewardCents },
              { header: 'Created', accessor: (row: Referral) => formatDate(row.createdAt), sortKey: (row: Referral) => row.createdAt },
              { header: 'Actions', accessor: (row: Referral) => (
                row.status === 'completed' ? (
                  <div className="flex-gap-sm">
                    <button className="btn btn-primary btn-xs" onClick={() => setConfirmTarget({ id: row.id, action: 'reward' })} disabled={isProcessing}>
                      Mark Rewarded
                    </button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirmTarget({ id: row.id, action: 'expire' })} disabled={isProcessing}>
                      Expire
                    </button>
                  </div>
                ) : null
              )},
            ]}
            data={filteredReferrals}
            isLoading={isLoading}
          />
        </div>

        <ConfirmDialog
          isOpen={!!confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={() => confirmTarget && handleAction(confirmTarget.id, confirmTarget.action)}
          title={confirmTarget?.action === 'reward' ? 'Mark Referral Rewarded' : 'Expire Referral'}
          message={confirmTarget?.action === 'reward'
            ? 'This will mark the referral as rewarded and trigger the reward payout. Continue?'
            : 'This will expire the referral and it can no longer be rewarded. Continue?'}
          confirmText={confirmTarget?.action === 'reward' ? 'Mark Rewarded' : 'Expire'}
          variant={confirmTarget?.action === 'expire' ? 'destructive' : 'primary'}
          isLoading={isProcessing}
        />
      </AnimatedPage>
    </RoleGate>
  );
}
