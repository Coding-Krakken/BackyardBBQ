'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { fetcher, formatCurrency, formatDate } from '@/lib/utils';

interface Transaction {
  id: string;
  orderId: string;
  method: string;
  provider: string | null;
  amountCents: number;
  status: string;
  createdAt: string;
}

interface Dispute {
  id: string;
  transactionId: string;
  reason: string;
  status: string;
  amountCents: number;
  createdAt: string;
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'disputes'>('transactions');
  const [page, setPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundTarget, setRefundTarget] = useState<string | null>(null);
  const { addToast } = useToast();
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data: txData, mutate: mutateTx, isLoading: txLoading } = useSWR<{ data: Transaction[] }>(
    `/api/admin/payments?limit=${limit}&offset=${offset}`,
    fetcher
  );

  const { data: disputeData, mutate: mutateDisputes, isLoading: disputeLoading } = useSWR<{ data: Dispute[] }>(
    `/api/admin/payments/disputes?limit=${limit}&offset=${offset}`,
    fetcher
  );

  const handleRefund = async (transactionId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/payments/${transactionId}/refund`, { method: 'POST' });
      if (response.ok) {
        addToast({ type: 'success', message: 'Refund initiated' });
        await mutateTx();
      } else {
        addToast({ type: 'error', message: 'Refund failed' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsProcessing(false);
      setRefundTarget(null);
    }
  }; 

  const handleDisputeAction = async (disputeId: string, action: 'accept' | 'challenge') => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/payments/disputes/${disputeId}/${action}`, { method: 'POST' });
      if (response.ok) {
        addToast({ type: 'success', message: `Dispute ${action === 'accept' ? 'accepted' : 'challenged'}` });
        await mutateDisputes();
      } else {
        addToast({ type: 'error', message: 'Action failed' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'accounting']}>
      <AnimatedPage>
        <PageHeader title="Payments" subtitle="Transaction history and dispute management" />

        <div className="tabs mb-lg">
          <button className={`tab ${activeTab === 'transactions' ? 'tab-active' : ''}`} onClick={() => setActiveTab('transactions')}>Transactions</button>
          <button className={`tab ${activeTab === 'disputes' ? 'tab-active' : ''}`} onClick={() => setActiveTab('disputes')}>Disputes</button>
        </div>

        {activeTab === 'transactions' && (
          <div className="panel">
            <DataTable
              columns={[
                { header: 'ID', accessor: (row: Transaction) => row.id.slice(0, 8) },
                { header: 'Order', accessor: (row: Transaction) => row.orderId.slice(0, 8) },
                { header: 'Method', accessor: (row: Transaction) => row.method, sortKey: (row: Transaction) => row.method },
                { header: 'Provider', accessor: (row: Transaction) => row.provider ?? 'N/A' },
                { header: 'Amount', accessor: (row: Transaction) => formatCurrency(row.amountCents), sortKey: (row: Transaction) => row.amountCents },
                { header: 'Status', accessor: (row: Transaction) => <StatusBadge status={row.status} type="payment" />, sortKey: (row: Transaction) => row.status },
                { header: 'Date', accessor: (row: Transaction) => formatDate(row.createdAt), sortKey: (row: Transaction) => row.createdAt },
                { header: 'Actions', accessor: (row: Transaction) => (
                  row.status === 'completed' ? (
                    <button className="btn btn-danger btn-xs" onClick={() => setRefundTarget(row.id)} disabled={isProcessing}>
                      Refund
                    </button>
                  ) : null
                )},
              ]}
              data={txData?.data ?? []}
              currentPage={page}
              totalPages={Math.max(1, Math.ceil((txData?.data.length ?? 0) / limit))}
              onPageChange={setPage}
              isLoading={txLoading}
            />
          </div>
        )}

        {activeTab === 'disputes' && (
          <div className="panel">
            <DataTable
              columns={[
                { header: 'ID', accessor: (row: Dispute) => row.id.slice(0, 8) },
                { header: 'Transaction', accessor: (row: Dispute) => row.transactionId.slice(0, 8) },
                { header: 'Reason', accessor: (row: Dispute) => row.reason },
                { header: 'Amount', accessor: (row: Dispute) => formatCurrency(row.amountCents), sortKey: (row: Dispute) => row.amountCents },
                { header: 'Status', accessor: (row: Dispute) => <StatusBadge status={row.status} />, sortKey: (row: Dispute) => row.status },
                { header: 'Date', accessor: (row: Dispute) => formatDate(row.createdAt), sortKey: (row: Dispute) => row.createdAt },
                { header: 'Actions', accessor: (row: Dispute) => (
                  row.status === 'open' ? (
                    <div className="flex-gap-sm">
                      <button className="btn btn-ghost btn-xs" onClick={() => handleDisputeAction(row.id, 'accept')} disabled={isProcessing}>Accept</button>
                      <button className="btn btn-primary btn-xs" onClick={() => handleDisputeAction(row.id, 'challenge')} disabled={isProcessing}>Challenge</button>
                    </div>
                  ) : null
                )},
              ]}
              data={disputeData?.data ?? []}
              currentPage={page}
              totalPages={Math.max(1, Math.ceil((disputeData?.data.length ?? 0) / limit))}
              onPageChange={setPage}
              isLoading={disputeLoading}
            />
          </div>
        )}

        <ConfirmDialog
          isOpen={refundTarget !== null}
          onClose={() => setRefundTarget(null)}
          onConfirm={() => refundTarget && handleRefund(refundTarget)}
          title="Confirm Refund"
          message="Are you sure you want to refund this transaction? This action cannot be undone."
          confirmText="Refund"
          variant="destructive"
          isLoading={isProcessing}
        />
      </AnimatedPage>
    </RoleGate>
  );
}
