'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Card,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Button,
  Badge,
} from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Referral {
  id: string;
  referralCode: string;
  refereeEmail?: string | null;
  referrerId: string;
  refereeId?: string;
  status: string;
  rewardCents: number;
  expiresAt?: string;
  createdAt: string;
  referrer?: { email: string; firstName?: string | null; lastName?: string | null };
  referee?: { email: string; firstName?: string | null; lastName?: string | null };
}

const REFERRAL_TAB_FILTERS = ['all', 'pending', 'completed', 'rewarded', 'expired'] as const;
const REFERRAL_STATUSES = ['pending', 'completed', 'rewarded', 'expired'] as const;

export default function ReferralsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReferral, setSelectedReferral] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<'rewarded' | 'expired' | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const { data, mutate } = useSWR<{ data: Referral[] }>(
    statusFilter === 'all'
      ? '/api/admin/referrals'
      : `/api/admin/referrals?status=${statusFilter}`,
    fetcher
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleUpdateStatus = async () => {
    if (!selectedReferral || !newStatus) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/referrals/${selectedReferral}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await mutate();
        setSelectedReferral(null);
        setNewStatus(null);
      }
    } catch (error) {
      console.error('Failed to update referral status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, any> = {
      pending: 'yellow',
      completed: 'blue',
      rewarded: 'green',
      expired: 'red',
    };
    return colors[status] || 'gray';
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin']}>
    <div className="p-6">
      <PageHeader
        title="Referrals"
        subtitle="Manage customer referral program"
      />

      <Card>
        <TabGroup
          index={REFERRAL_TAB_FILTERS.indexOf(statusFilter as (typeof REFERRAL_TAB_FILTERS)[number])}
          onIndexChange={(index) => setStatusFilter(REFERRAL_TAB_FILTERS[index] ?? 'all')}
        >
          <TabList>
            <Tab>All</Tab>
            <Tab>Pending</Tab>
            <Tab>Completed</Tab>
            <Tab>Rewarded</Tab>
            <Tab>Expired</Tab>
          </TabList>
          <TabPanels>
            {/* All and individual status tabs show same table with different filters */}
            {[...Array(REFERRAL_STATUSES.length + 1)].map((_, idx) => (
              <TabPanel key={idx}>
                <DataTable
                  columns={[
                    { header: 'Code', accessor: (row: Referral) => row.referralCode },
                    {
                      header: 'Referrer',
                      accessor: (row: Referral) => {
                        const fullName = [row.referrer?.firstName, row.referrer?.lastName]
                          .filter(Boolean)
                          .join(' ')
                          .trim();
                        return fullName || row.referrer?.email || 'N/A';
                      },
                    },
                    {
                      header: 'Referee',
                      accessor: (row: Referral) => row.referee?.email || row.refereeEmail || 'Not used',
                    },
                    {
                      header: 'Status',
                      accessor: (row: Referral) => (
                        <Badge color={getStatusBadgeColor(row.status)}>{row.status}</Badge>
                      ),
                    },
                    {
                      header: 'Reward',
                      accessor: (row: Referral) => formatCurrency(row.rewardCents),
                    },
                    {
                      header: 'Expires',
                      accessor: (row: Referral) => formatDate(row.expiresAt),
                    },
                    {
                      header: 'Actions',
                      accessor: (row: Referral) =>
                        row.status === 'completed' ? (
                          <div className="flex gap-2">
                            <Button
                              size="xs"
                              color="green"
                              variant="secondary"
                              onClick={() => {
                                setSelectedReferral(row.id);
                                setNewStatus('rewarded');
                              }}
                            >
                              Mark Rewarded
                            </Button>
                            <Button
                              size="xs"
                              color="red"
                              variant="secondary"
                              onClick={() => {
                                setSelectedReferral(row.id);
                                setNewStatus('expired');
                              }}
                            >
                              Mark Expired
                            </Button>
                          </div>
                        ) : null,
                    },
                  ]}
                  data={data?.data ?? []}
                />
              </TabPanel>
            ))}
          </TabPanels>
        </TabGroup>
      </Card>

      {/* Update Confirmation */}
      <ConfirmDialog
        isOpen={selectedReferral !== null}
        onClose={() => {
          setSelectedReferral(null);
          setNewStatus(null);
        }}
        onConfirm={handleUpdateStatus}
        title={`Mark Referral as ${newStatus}`}
        message={`Are you sure you want to mark this referral as ${newStatus}?`}
        confirmText="Update"
        variant={newStatus === 'expired' ? 'destructive' : 'primary'}
        isLoading={isUpdating}
      />
    </div>
    </RoleGate>
  );
}
