'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, TabGroup, TabList, Tab, TabPanels, TabPanel, Button } from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Payment {
  stripePaymentIntentId: string;
  orderId?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface Dispute {
  id: string;
  disputeId: string;
  paymentIntentId: string;
  amountCents: number;
  reason: string;
  status: string;
  createdAt: string;
}

export default function PaymentsPage() {
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  const { data: paymentsData, mutate: mutatePayments } = useSWR<{ data: Payment[] }>(
    '/api/admin/payments?limit=20',
    fetcher
  );

  const { data: disputesData, mutate: mutateDisputes } = useSWR<{ data: Dispute[] }>(
    '/api/admin/payments/disputes?limit=20',
    fetcher
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;

    setIsRefunding(true);
    try {
      const response = await fetch('/api/admin/payments/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: selectedPayment }),
      });

      if (response.ok) {
        await mutatePayments();
        setSelectedPayment(null);
      }
    } catch (error) {
      console.error('Failed to refund payment:', error);
    } finally {
      setIsRefunding(false);
    }
  };

  const handleReviewDispute = async () => {
    if (!selectedDispute) return;

    setIsReviewing(true);
    try {
      const response = await fetch(`/api/admin/payments/disputes/${selectedDispute}/review`, {
        method: 'PATCH',
      });

      if (response.ok) {
        await mutateDisputes();
        setSelectedDispute(null);
      }
    } catch (error) {
      console.error('Failed to review dispute:', error);
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'accounting']}>
    <div className="p-6">
      <PageHeader
        title="Payments & Disputes"
        subtitle="Manage payment transactions and handle disputes"
      />

      <Card>
        <TabGroup>
          <TabList>
            <Tab>Transactions</Tab>
            <Tab>Disputes</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <DataTable
                columns={[
                  {
                    header: 'Payment Intent',
                    accessor: (row: Payment) => row.stripePaymentIntentId.slice(0, 16) + '...',
                  },
                  {
                    header: 'Order ID',
                    accessor: (row: Payment) => row.orderId?.slice(0, 8) ?? 'N/A',
                  },
                  {
                    header: 'Amount',
                    accessor: (row: Payment) => formatCurrency(row.amountCents),
                  },
                  {
                    header: 'Status',
                    accessor: (row: Payment) => <StatusBadge status={row.status} />,
                  },
                  {
                    header: 'Created',
                    accessor: (row: Payment) => formatDate(row.createdAt),
                  },
                  {
                    header: 'Actions',
                    accessor: (row: Payment) =>
                      row.status === 'succeeded' ? (
                        <Button
                          size="xs"
                          color="red"
                          variant="secondary"
                          onClick={() => setSelectedPayment(row.stripePaymentIntentId)}
                        >
                          Refund
                        </Button>
                      ) : null,
                  },
                ]}
                data={paymentsData?.data ?? []}
              />
            </TabPanel>
            <TabPanel>
              <DataTable
                columns={[
                  {
                    header: 'Dispute ID',
                    accessor: (row: Dispute) => row.disputeId.slice(0, 12),
                  },
                  {
                    header: 'Payment Intent',
                    accessor: (row: Dispute) => row.paymentIntentId.slice(0, 12) + '...',
                  },
                  {
                    header: 'Amount',
                    accessor: (row: Dispute) => formatCurrency(row.amountCents),
                  },
                  { header: 'Reason', accessor: (row: Dispute) => row.reason },
                  {
                    header: 'Status',
                    accessor: (row: Dispute) => <StatusBadge status={row.status} />,
                  },
                  {
                    header: 'Created',
                    accessor: (row: Dispute) => formatDate(row.createdAt),
                  },
                  {
                    header: 'Actions',
                    accessor: (row: Dispute) =>
                      row.status !== 'reviewed' ? (
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => setSelectedDispute(row.id)}
                        >
                          Mark Reviewed
                        </Button>
                      ) : null,
                  },
                ]}
                data={disputesData?.data ?? []}
              />
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </Card>

      {/* Refund Confirmation Dialog */}
      <ConfirmDialog
        isOpen={selectedPayment !== null}
        onClose={() => setSelectedPayment(null)}
        onConfirm={handleRefund}
        title="Confirm Refund"
        message="Are you sure you want to refund this payment? This action cannot be undone."
        confirmText="Refund"
        variant="destructive"
        isLoading={isRefunding}
      />

      {/* Dispute Review Confirmation Dialog */}
      <ConfirmDialog
        isOpen={selectedDispute !== null}
        onClose={() => setSelectedDispute(null)}
        onConfirm={handleReviewDispute}
        title="Mark Dispute as Reviewed"
        message="Mark this dispute as reviewed? This indicates you have reviewed the dispute details."
        confirmText="Mark Reviewed"
        isLoading={isReviewing}
      />
    </div>
    </RoleGate>
  );
}
